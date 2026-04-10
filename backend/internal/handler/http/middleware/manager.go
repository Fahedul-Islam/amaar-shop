package middleware

import "net/http"

// Middleware is a function that wraps an http.Handler.
type Middleware func(http.Handler) http.Handler

// Manager holds global middleware and provides helpers to compose per-route chains.
type Manager struct {
	global []Middleware
}

func NewManager() *Manager {
	return &Manager{}
}

// Use registers middleware that runs on every request (e.g. logging, recovery).
// Middleware is applied in the order registered.
func (m *Manager) Use(mw ...Middleware) {
	m.global = append(m.global, mw...)
}

// With returns a single Middleware that chains the given middleware together.
// Use it to build per-route stacks: mw.With(auth, rateLimit).Then(handler).
func (m *Manager) With(mw ...Middleware) Chain {
	return Chain{mw}
}

// Handler wraps the final http.Handler (typically the mux) with all global middleware.
func (m *Manager) Handler(h http.Handler) http.Handler {
	// Apply in reverse so the first registered middleware is outermost.
	for i := len(m.global) - 1; i >= 0; i-- {
		h = m.global[i](h)
	}
	return h
}

// Chain is a sequence of per-route middleware.
type Chain struct {
	mw []Middleware
}

// Then wraps an http.HandlerFunc with the chain's middleware, returning a plain HandlerFunc
// suitable for mux.HandleFunc().
func (c Chain) Then(hf http.HandlerFunc) http.HandlerFunc {
	var h http.Handler = hf
	for i := len(c.mw) - 1; i >= 0; i-- {
		h = c.mw[i](h)
	}
	return h.ServeHTTP
}

// ThenHandler wraps an http.Handler with the chain's middleware.
func (c Chain) ThenHandler(h http.Handler) http.Handler {
	for i := len(c.mw) - 1; i >= 0; i-- {
		h = c.mw[i](h)
	}
	return h
}
