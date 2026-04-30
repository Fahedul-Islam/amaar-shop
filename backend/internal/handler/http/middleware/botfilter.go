package middleware

import (
	"context"
	"net/http"
	"strings"
)

// botContextKey distinguishes the bot flag from other context values.
type botContextKey struct{}

// botSignatures lists case-insensitive substrings that mark the User-Agent as
// a known crawler / monitor / preview-bot. The match is intentionally broad:
// missing a real user (false negative) is much worse for analytics than
// occasionally over-counting a bot as a real visit (false positive).
var botSignatures = []string{
	"bot", "spider", "crawler", "slurp",
	"googlebot", "bingbot", "duckduckbot", "yandexbot", "baiduspider",
	"ahrefs", "semrush", "mj12bot", "dotbot",
	"facebookexternalhit", "facebookcatalog", "facebot",
	"twitterbot", "linkedinbot", "whatsapp", "telegrambot", "discordbot",
	"slackbot", "viber",
	"pingdom", "uptimerobot", "statuscake", "lighthouse", "headlesschrome",
	"curl/", "wget/", "python-requests", "go-http-client", "okhttp",
	"postman", "insomnia",
	"applebot",
}

// IsBot returns true if the User-Agent header looks like a known crawler.
// Empty user agents also count as bots — real browsers always send one.
func IsBot(userAgent string) bool {
	ua := strings.ToLower(strings.TrimSpace(userAgent))
	if ua == "" {
		return true
	}
	for _, sig := range botSignatures {
		if strings.Contains(ua, sig) {
			return true
		}
	}
	return false
}

// BotFilter annotates the request context with a bot flag derived from the
// User-Agent header. Downstream handlers (the visit-tracking hook) read the
// flag via IsBotRequest and skip persistence for bots.
//
// We don't *block* bots here — they're free to read product pages, we just
// don't pollute analytics with them.
func BotFilter() Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := context.WithValue(r.Context(), botContextKey{}, IsBot(r.UserAgent()))
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// IsBotRequest reports whether BotFilter classified r as a bot.
// Returns false if BotFilter wasn't applied — fail-open for safety.
func IsBotRequest(r *http.Request) bool {
	flag, _ := r.Context().Value(botContextKey{}).(bool)
	return flag
}
