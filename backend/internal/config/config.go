package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Port               int
	Env                string
	DatabaseURL        string
	JWTSecret          string
	UploadDir          string
	AdminEmail         string
	AdminPass          string
	CORSAllowedOrigins []string
	SteadfastBaseURL   string
}

// IsProduction reports whether the app is running in a production environment.
// Used to gate Secure cookies, which browsers reject over plain HTTP in dev.
func (c *Config) IsProduction() bool {
	return c.Env == "production"
}

func Load() (*Config, error) {
	port := 8080
	if p := os.Getenv("PORT"); p != "" {
		var err error
		port, err = strconv.Atoi(p)
		if err != nil {
			return nil, fmt.Errorf("invalid PORT: %w", err)
		}
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET is required")
	}

	uploadDir := os.Getenv("UPLOAD_DIR")
	if uploadDir == "" {
		uploadDir = "./uploads"
	}

	env := os.Getenv("ENV")
	if env == "" {
		env = "development"
	}

	corsAllowedOrigins := parseCSV(os.Getenv("CORS_ALLOWED_ORIGINS"))
	if len(corsAllowedOrigins) == 0 && env != "production" {
		corsAllowedOrigins = []string{"http://localhost:3000"}
	}

	return &Config{
		Port:               port,
		Env:                env,
		DatabaseURL:        dbURL,
		JWTSecret:          jwtSecret,
		UploadDir:          uploadDir,
		AdminEmail:         os.Getenv("ADMIN_EMAIL"),
		AdminPass:          os.Getenv("ADMIN_PASSWORD"),
		CORSAllowedOrigins: corsAllowedOrigins,
		SteadfastBaseURL:   os.Getenv("STEADFAST_BASE_URL"), // empty → client uses production default
	}, nil
}

func parseCSV(value string) []string {
	if value == "" {
		return nil
	}

	parts := strings.Split(value, ",")
	items := make([]string, 0, len(parts))
	for _, part := range parts {
		item := strings.TrimSpace(part)
		if item != "" {
			items = append(items, item)
		}
	}
	return items
}
