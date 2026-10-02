// Command otp prints an admin login code for local development, where the
// admin bot may not run.
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/SalikhovID/hisob24/backend/internal/auth"
	"github.com/SalikhovID/hisob24/backend/internal/config"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

func main() {
	telegramID := flag.Int64("telegram-id", 0, "admin to log in as (default: the first active admin)")
	flag.Parse()
	if err := run(context.Background(), *telegramID, os.Getenv, os.Stdout); err != nil {
		fmt.Fprintln(os.Stderr, "otp:", err)
		os.Exit(1)
	}
}

func run(ctx context.Context, telegramID int64, getenv func(string) string, out io.Writer) error {
	cfg, err := config.Load(getenv)
	if err != nil {
		return err
	}
	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	if telegramID == 0 {
		if telegramID, err = firstActiveAdmin(ctx, gen.New(pool)); err != nil {
			return err
		}
	}
	code, err := auth.NewAdminAuth(pool, cfg.OTPHMACSecret, cfg.AdminBotToken).IssueLoginCode(ctx, telegramID)
	if err != nil {
		return fmt.Errorf("admin %d: %w", telegramID, err)
	}
	_, err = fmt.Fprintf(out, "Kod: %s (1 daqiqa amal qiladi), admin %d\n", code.Code, telegramID)
	return err
}

func firstActiveAdmin(ctx context.Context, q *gen.Queries) (int64, error) {
	admins, err := q.ListAdmins(ctx)
	if err != nil {
		return 0, err
	}
	for _, a := range admins {
		if a.IsActive {
			return a.TelegramID, nil
		}
	}
	return 0, errors.New("no active admin")
}
