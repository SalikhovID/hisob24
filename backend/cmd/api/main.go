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
	"github.com/SalikhovID/hisob24/backend/internal/app"
	"github.com/SalikhovID/hisob24/backend/internal/auth"
	"github.com/SalikhovID/hisob24/backend/internal/billing"
	"github.com/SalikhovID/hisob24/backend/internal/bot/adminbot"
	"github.com/SalikhovID/hisob24/backend/internal/bot/userbot"
	"github.com/SalikhovID/hisob24/backend/internal/company"
	"github.com/SalikhovID/hisob24/backend/internal/config"
	"github.com/SalikhovID/hisob24/backend/internal/customer"
	"github.com/SalikhovID/hisob24/backend/internal/httpx"
	"github.com/SalikhovID/hisob24/backend/internal/sms"
	"github.com/SalikhovID/hisob24/backend/internal/user"
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
	companies := company.NewService(pool)
	adminAPI := admin.NewHandler(admin.Services{
		Auth:      adminAuth,
		Companies: companies,
		Billing:   billing.NewService(pool),
	}, cfg.CookieSecure, httpx.NewRateLimiter(5, time.Minute))
	if cfg.SMSDriver == "log" {
		slog.Warn("SMS_DRIVER=log: login codes go to this log, no SMS is sent")
	}
	userAuth := auth.NewUserAuth(pool, cfg.OTPHMACSecret, cfg.JWTSecret, cfg.UserBotToken, sms.New(cfg, slog.Default()))
	appAPI := app.NewHandler(app.Services{
		Auth:      userAuth,
		Profiles:  user.NewProfiles(pool),
		Companies: companies,
		Customers: customer.NewService(pool),
	}, cfg.CookieSecure, httpx.NewRateLimiter(5, time.Minute), httpx.NewRateLimiter(5, time.Minute))
	mounts := []func(chi.Router){adminAPI.Routes, appAPI.Routes}

	adminWebhook, err := startAdminBot(ctx, cfg, adminAuth)
	if err != nil {
		return err
	}
	if adminWebhook != nil {
		mounts = append(mounts, func(r chi.Router) {
			r.With(httpx.TelegramSecret(cfg.TelegramWebhookSecret)).Post(adminbot.WebhookPath, adminWebhook)
		})
	}
	userWebhook, err := startUserBot(ctx, cfg, user.NewContacts(pool))
	if err != nil {
		return err
	}
	if userWebhook != nil {
		mounts = append(mounts, func(r chi.Router) {
			r.With(httpx.TelegramSecret(cfg.TelegramWebhookSecret)).Post(userbot.WebhookPath, userWebhook)
		})
	}

	// The Mini Apps' session cookies are SameSite=None: state changes from
	// other sites are refused for every route.
	guard, err := httpx.CrossOriginGuard(cfg.AdminPanelURL, cfg.WebAppURL)
	if err != nil {
		return fmt.Errorf("ADMIN_PANEL_URL or WEB_APP_URL: %w", err)
	}
	srv := &http.Server{
		Addr:              cfg.HTTPAddr,
		Handler:           guard(httpx.NewRouter(mounts...)),
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

// startUserBot runs the user bot when USER_BOT_TOKEN is set: polling in a
// goroutine, or, in webhook mode, returns the handler Telegram's calls must
// reach.
func startUserBot(ctx context.Context, cfg config.Config, contacts *user.Contacts) (http.HandlerFunc, error) {
	if cfg.UserBotToken == "" {
		slog.Warn("USER_BOT_TOKEN is empty: the user bot is off")
		return nil, nil
	}
	var handler *userbot.Handler
	b, err := bot.New(cfg.UserBotToken,
		bot.WithDefaultHandler(func(ctx context.Context, _ *bot.Bot, u *models.Update) { handler.Handle(ctx, u) }),
		bot.WithErrorsHandler(func(err error) { slog.Error("user bot", "err", err) }),
	)
	if err != nil {
		return nil, fmt.Errorf("user bot: %w", err)
	}
	handler = userbot.NewHandler(b, contacts)
	if err := userbot.SetMenuButton(ctx, b, cfg.WebAppURL); err != nil {
		// Telegram accepts only https Mini App URLs; the bot works without the button.
		slog.Warn("user bot: menu button not set", "err", err)
	}
	if cfg.BotMode == "webhook" {
		if err := userbot.RegisterWebhook(ctx, b, cfg.PublicAPIURL, cfg.TelegramWebhookSecret); err != nil {
			return nil, err
		}
		go b.StartWebhook(ctx)
		return b.WebhookHandler(), nil
	}
	go b.Start(ctx)
	slog.Info("user bot polling")
	return nil, nil
}
