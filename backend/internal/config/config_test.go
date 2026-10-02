package config

import (
	"maps"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLoad(t *testing.T) {
	tests := []struct {
		name    string
		env     map[string]string
		want    Config
		wantErr []string // every substring must appear in the error
	}{
		{
			name: "defaults for optional keys",
			env:  requiredEnv(),
			want: Config{
				DatabaseURL:   "postgres://localhost/hisob24",
				HTTPAddr:      ":8080",
				BotMode:       "polling",
				OTPHMACSecret: "otp-secret",
				JWTSecret:     "jwt-secret",
				CookieSecure:  true,
				SMSDriver:     "log",
				EskizFrom:     "4546",
			},
		},
		{
			name: "every key is read",
			env: with(requiredEnv(), map[string]string{
				"HTTP_ADDR":               ":9090",
				"ADMIN_BOT_TOKEN":         "admin-token",
				"USER_BOT_TOKEN":          "user-token",
				"BOT_MODE":                "webhook",
				"TELEGRAM_WEBHOOK_SECRET": "hook-secret",
				"PUBLIC_API_URL":          "https://api.example.uz",
				"ADMIN_PANEL_URL":         "https://admin.example.uz",
				"SMS_DRIVER":              "eskiz",
				"ESKIZ_EMAIL":             "sms@example.uz",
				"ESKIZ_PASSWORD":          "eskiz-pass",
				"ESKIZ_FROM":              "4545",
			}),
			want: Config{
				DatabaseURL:           "postgres://localhost/hisob24",
				HTTPAddr:              ":9090",
				AdminBotToken:         "admin-token",
				UserBotToken:          "user-token",
				BotMode:               "webhook",
				TelegramWebhookSecret: "hook-secret",
				PublicAPIURL:          "https://api.example.uz",
				AdminPanelURL:         "https://admin.example.uz",
				OTPHMACSecret:         "otp-secret",
				JWTSecret:             "jwt-secret",
				CookieSecure:          true,
				SMSDriver:             "eskiz",
				EskizEmail:            "sms@example.uz",
				EskizPassword:         "eskiz-pass",
				EskizFrom:             "4545",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Load(func(key string) string { return tt.env[key] })

			if len(tt.wantErr) > 0 {
				require.Error(t, err)
				for _, s := range tt.wantErr {
					assert.ErrorContains(t, err, s)
				}
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tt.want, got)
		})
	}
}

func requiredEnv() map[string]string {
	return map[string]string{
		"DATABASE_URL":    "postgres://localhost/hisob24",
		"OTP_HMAC_SECRET": "otp-secret",
		"JWT_SECRET":      "jwt-secret",
	}
}

func with(base, extra map[string]string) map[string]string {
	out := maps.Clone(base)
	maps.Copy(out, extra)
	return out
}
