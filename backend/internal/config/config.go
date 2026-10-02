// Package config reads the API process settings from the environment.
package config

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
// back to their defaults.
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
	return cfg, nil
}

func orDefault(v, def string) string {
	if v == "" {
		return def
	}
	return v
}
