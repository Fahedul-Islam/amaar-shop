package middleware

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

// bucket tracks request counts per IP using a token-bucket algorithm.
type bucket struct {
	tokens    float64
	lastCheck time.Time
}

// RateLimiter is an in-memory per-IP rate limiter.
type RateLimiter struct {
	mu       sync.Mutex
	buckets  map[string]*bucket
	rate     float64 // tokens per second
	capacity float64 // max burst size
}

// NewRateLimiter creates a rate limiter with the given requests-per-minute and burst size.
func NewRateLimiter(requestsPerMinute int, burst int) *RateLimiter {
	rl := &RateLimiter{
		buckets:  make(map[string]*bucket),
		rate:     float64(requestsPerMinute) / 60.0,
		capacity: float64(burst),
	}

	// Clean up stale entries every 5 minutes
	go func() {
		for {
			time.Sleep(5 * time.Minute)
			rl.cleanup()
		}
	}()

	return rl
}

// Limit returns a Middleware that rate-limits requests by client IP.
// Returns 429 Too Many Requests when the limit is exceeded.
func (rl *RateLimiter) Limit() Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := clientIP(r)
			if !rl.allow(ip) {
				w.Header().Set("Retry-After", "60")
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusTooManyRequests)
				w.Write([]byte(`{"error":{"code":"rate_limited","message":"too many requests, try again later"}}`))
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func (rl *RateLimiter) allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	b, exists := rl.buckets[ip]
	now := time.Now()

	if !exists {
		rl.buckets[ip] = &bucket{tokens: rl.capacity - 1, lastCheck: now}
		return true
	}

	elapsed := now.Sub(b.lastCheck).Seconds()
	b.tokens += elapsed * rl.rate
	if b.tokens > rl.capacity {
		b.tokens = rl.capacity
	}
	b.lastCheck = now

	if b.tokens < 1 {
		return false
	}

	b.tokens--
	return true
}

func (rl *RateLimiter) cleanup() {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	cutoff := time.Now().Add(-10 * time.Minute)
	for ip, b := range rl.buckets {
		if b.lastCheck.Before(cutoff) {
			delete(rl.buckets, ip)
		}
	}
}

func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		// X-Forwarded-For may contain multiple IPs; use the first (client) one
		first := strings.SplitN(xff, ",", 2)[0]
		return strings.TrimSpace(first)
	}
	if ip, _, err := net.SplitHostPort(r.RemoteAddr); err == nil {
		return ip
	}
	return r.RemoteAddr
}
