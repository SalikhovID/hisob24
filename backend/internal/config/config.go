// Package config reads the API process settings from the environment.
package config

import (
	"errors"
	"fmt"
	"strconv"
)

// Config holds every setting the API process reads from the environment.
type Config struct {
	DatabaseURL           string
	HTTPAddr              string
	AdminBotToken         string
	UserBotToken          string
	BotMode               string
	TelegramWebhookSecret string
	PublicAPIURL          string
	AdminPanelURL         string
	OTPHMACSecret         string
	JWTSecret             string
	CookieSecure          bool
	SMSDriver             string
	EskizEmail            string
	EskizPassword         string
	EskizFrom             string
}

// Load builds a Config from getenv (os.Getenv in main). Optional keys fall
// back to their defaults; every problem is reported in one error.
func Load(getenv func(string) string) (Config, error) {
	cfg := Config{
		DatabaseURL:           getenv("DATABASE_URL"),
		HTTPAddr:              orDefault(getenv("HTTP_ADDR"), ":8080"),
		AdminBotToken:         getenv("ADMIN_BOT_TOKEN"),
		UserBotToken:          getenv("USER_BOT_TOKEN"),
		BotMode:               orDefault(getenv("BOT_MODE"), "polling"),
		TelegramWebhookSecret: getenv("TELEGRAM_WEBHOOK_SECRET"),
		PublicAPIURL:          getenv("PUBLIC_API_URL"),
		AdminPanelURL:         getenv("ADMIN_PANEL_URL"),
		OTPHMACSecret:         getenv("OTP_HMAC_SECRET"),
		JWTSecret:             getenv("JWT_SECRET"),
		CookieSecure:          true,
		SMSDriver:             orDefault(getenv("SMS_DRIVER"), "log"),
		EskizEmail:            getenv("ESKIZ_EMAIL"),
		EskizPassword:         getenv("ESKIZ_PASSWORD"),
		EskizFrom:             orDefault(getenv("ESKIZ_FROM"), "4546"),
	}

	var errs []error
	for _, req := range []struct{ key, val string }{
		{"DATABASE_URL", cfg.DatabaseURL},
		{"OTP_HMAC_SECRET", cfg.OTPHMACSecret},
		{"JWT_SECRET", cfg.JWTSecret},
	} {
		if req.val == "" {
			errs = append(errs, fmt.Errorf("%s is required", req.key))
		}
	}
	if cfg.BotMode != "polling" && cfg.BotMode != "webhook" {
		errs = append(errs, fmt.Errorf("BOT_MODE must be polling or webhook, got %q", cfg.BotMode))
	}
	if cfg.SMSDriver != "log" && cfg.SMSDriver != "eskiz" {
		errs = append(errs, fmt.Errorf("SMS_DRIVER must be log or eskiz, got %q", cfg.SMSDriver))
	}
	if cfg.BotMode == "webhook" {
		for _, req := range []struct{ key, val string }{
			{"TELEGRAM_WEBHOOK_SECRET", cfg.TelegramWebhookSecret},
			{"PUBLIC_API_URL", cfg.PublicAPIURL},
		} {
			if req.val == "" {
				errs = append(errs, fmt.Errorf("%s is required when BOT_MODE=webhook", req.key))
			}
		}
	}
	if v := getenv("COOKIE_SECURE"); v != "" {
		secure, err := strconv.ParseBool(v)
		if err != nil {
			errs = append(errs, fmt.Errorf("COOKIE_SECURE must be true or false, got %q", v))
		} else {
			cfg.CookieSecure = secure
		}
	}
	if len(errs) > 0 {
		return Config{}, fmt.Errorf("config: %w", errors.Join(errs...))
	}
	return cfg, nil
}

func orDefault(v, def string) string {
	if v == "" {
		return def
	}
	return v
}
