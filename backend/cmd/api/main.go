// Command api runs the Hisob24 HTTP API together with the admin Telegram bot.
package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-telegram/bot"
	"github.com/go-telegram/bot/models"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/SalikhovID/hisob24/backend/internal/admin"
	"github.com/SalikhovID/hisob24/backend/internal/auth"
	"github.com/SalikhovID/hisob24/backend/internal/bot/adminbot"
	"github.com/SalikhovID/hisob24/backend/internal/config"
	"github.com/SalikhovID/hisob24/backend/internal/httpx"
)

func main() {
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, nil)))
	if err := run(); err != nil {
		slog.Error("api stopped", "err", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load(os.Getenv)
	if err != nil {
		return err
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		return fmt.Errorf("open database pool: %w", err)
	}
	defer pool.Close()
	if err := pool.Ping(ctx); err != nil {
		return fmt.Errorf("ping database: %w", err)
	}

	adminAuth := auth.NewAdminAuth(pool, cfg.OTPHMACSecret, cfg.AdminBotToken)
	adminAPI := admin.NewHandler(adminAuth, cfg.CookieSecure, httpx.NewRateLimiter(5, time.Minute))
	mounts := []func(chi.Router){adminAPI.Routes}

	adminWebhook, err := startAdminBot(ctx, cfg, adminAuth)
	if err != nil {
		return err
	}
	if adminWebhook != nil {
		mounts = append(mounts, func(r chi.Router) {
			r.With(httpx.TelegramSecret(cfg.TelegramWebhookSecret)).Post(adminbot.WebhookPath, adminWebhook)
		})
	}

	srv := &http.Server{
		Addr:              cfg.HTTPAddr,
		Handler:           httpx.NewRouter(mounts...),
		ReadHeaderTimeout: 10 * time.Second,
	}

	serveErr := make(chan error, 1)
	go func() {
		slog.Info("api listening", "addr", cfg.HTTPAddr)
		serveErr <- srv.ListenAndServe()
	}()

	select {
	case err := <-serveErr:
		return fmt.Errorf("serve http: %w", err)
	case <-ctx.Done():
	}

	slog.Info("api shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("shutdown http: %w", err)
	}
	return nil
}

// startAdminBot runs the admin bot when ADMIN_BOT_TOKEN is set: polling in a
// goroutine, or, in webhook mode, returns the handler Telegram's calls must
// reach.
func startAdminBot(ctx context.Context, cfg config.Config, a *auth.AdminAuth) (http.HandlerFunc, error) {
	if cfg.AdminBotToken == "" {
		slog.Warn("ADMIN_BOT_TOKEN is empty: the admin bot is off")
		return nil, nil
	}
	var handler *adminbot.Handler
	b, err := bot.New(cfg.AdminBotToken,
		bot.WithDefaultHandler(func(ctx context.Context, _ *bot.Bot, u *models.Update) { handler.Handle(ctx, u) }),
		bot.WithErrorsHandler(func(err error) { slog.Error("admin bot", "err", err) }),
	)
	if err != nil {
		return nil, fmt.Errorf("admin bot: %w", err)
	}
	handler = adminbot.NewHandler(b, a)
	if err := adminbot.SetMenuButton(ctx, b, cfg.AdminPanelURL); err != nil {
		// Telegram accepts only https Mini App URLs; the bot works without the button.
		slog.Warn("admin bot: menu button not set", "err", err)
	}
	if cfg.BotMode == "webhook" {
		if err := adminbot.RegisterWebhook(ctx, b, cfg.PublicAPIURL, cfg.TelegramWebhookSecret); err != nil {
			return nil, err
		}
		go b.StartWebhook(ctx)
		return b.WebhookHandler(), nil
	}
	go b.Start(ctx)
	slog.Info("admin bot polling")
	return nil, nil
}
