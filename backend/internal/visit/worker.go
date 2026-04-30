// Package visit holds the asynchronous visit-tracking pipeline:
//   - Worker buffers ProductVisit events on a channel and flushes them in batches.
//   - Aggregator runs nightly to roll raw events into product_visit_summary.
//
// The whole package is deliberately decoupled from the HTTP layer: handlers
// hand a domain.ProductVisit to Worker.Enqueue and never block on the DB.
package visit

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/repository"
)

// Config tunes the worker. Defaults are applied when fields are zero.
type Config struct {
	BufferSize    int           // channel capacity (default 1024)
	BatchSize     int           // max rows per INSERT (default 100)
	FlushInterval time.Duration // forced flush even if batch isn't full (default 5s)
	Workers       int           // number of consumer goroutines (default 2)
}

func (c *Config) applyDefaults() {
	if c.BufferSize <= 0 {
		c.BufferSize = 1024
	}
	if c.BatchSize <= 0 {
		c.BatchSize = 100
	}
	if c.FlushInterval <= 0 {
		c.FlushInterval = 5 * time.Second
	}
	if c.Workers <= 0 {
		c.Workers = 2
	}
}

// dedupWindow is the minimum spacing between counted visits from the same
// (visitor, product) pair. Catches React StrictMode double-fires, double-tap
// reloads, and any future duplicate-tracking source. Real return visits a few
// seconds apart are vanishingly rare.
const dedupWindow = 5 * time.Second

// Worker accepts visit events on a buffered channel and drains them with a
// pool of goroutines. Enqueue is non-blocking: if the buffer is full we drop
// the event (visit data is best-effort and we never want to slow the page).
type Worker struct {
	cfg  Config
	repo repository.VisitRepository
	log  *slog.Logger
	ch   chan domain.ProductVisit
	wg   sync.WaitGroup
	stop chan struct{}
	once sync.Once

	// stopped flips to true the moment Stop is called. Enqueue checks this
	// before sending so post-shutdown calls never panic with "send on closed
	// channel". Combined with not closing w.ch in Stop, the path is fully safe
	// even if HTTP handlers are racing the shutdown.
	stopped atomic.Bool

	// recent tracks the last visit timestamp per (visitor_id|product_id).
	// Bounded by sweepRecent which runs alongside the flush loop.
	recent sync.Map // key string -> time.Time
}

func NewWorker(repo repository.VisitRepository, log *slog.Logger, cfg Config) *Worker {
	cfg.applyDefaults()
	if log == nil {
		log = slog.Default()
	}
	return &Worker{
		cfg:  cfg,
		repo: repo,
		log:  log,
		ch:   make(chan domain.ProductVisit, cfg.BufferSize),
		stop: make(chan struct{}),
	}
}

// Start launches Workers consumer goroutines. Call once.
func (w *Worker) Start() {
	for i := 0; i < w.cfg.Workers; i++ {
		w.wg.Add(1)
		go w.consume()
	}
	go w.sweepRecent()
	w.log.Info("visit worker started", "workers", w.cfg.Workers, "buffer", w.cfg.BufferSize)
}

// Enqueue adds a visit to the buffer. Non-blocking — drops on overflow and
// logs at debug level so we don't spam logs under load.
//
// Also drops repeats from the same (visitor, product) within dedupWindow, so
// double-fired tracking calls (StrictMode, accidental beacon + GET overlap,
// rapid client reloads) don't inflate counts. The dedup is race-safe:
// LoadOrStore atomically claims the slot for the first arrival, and a CAS
// loop guards the timestamp update once the window has passed.
func (w *Worker) Enqueue(v domain.ProductVisit) {
	if w.stopped.Load() {
		return
	}

	key := v.VisitorID + "|" + v.ProductID
	now := v.VisitedAt

	for {
		prev, loaded := w.recent.LoadOrStore(key, now)
		if !loaded {
			// First arrival in the window — we own the slot, fall through to send.
			break
		}
		last, ok := prev.(time.Time)
		if !ok {
			// Should never happen, but be defensive — overwrite garbage.
			if w.recent.CompareAndSwap(key, prev, now) {
				break
			}
			continue
		}
		if now.Sub(last) < dedupWindow {
			return // duplicate inside the window
		}
		// Window expired. Try to claim the slot with our timestamp; if a peer
		// beat us, loop and re-evaluate against their newer timestamp.
		if w.recent.CompareAndSwap(key, prev, now) {
			break
		}
	}

	select {
	case w.ch <- v:
	default:
		w.log.Debug("visit buffer full, dropping event", "product_id", v.ProductID)
	}
}

// sweepRecent is a periodic janitor that drops dedup entries older than
// dedupWindow, so the map can't grow unbounded.
func (w *Worker) sweepRecent() {
	ticker := time.NewTicker(dedupWindow)
	defer ticker.Stop()
	for {
		select {
		case now := <-ticker.C:
			cutoff := now.Add(-dedupWindow)
			w.recent.Range(func(k, v any) bool {
				if t, ok := v.(time.Time); ok && t.Before(cutoff) {
					w.recent.Delete(k)
				}
				return true
			})
		case <-w.stop:
			return
		}
	}
}

// Stop signals consumers to drain and exit, then waits for in-flight batches
// to flush. We deliberately do NOT close w.ch — multiple HTTP handlers are
// concurrent senders, and closing the channel on the consumer side races
// with their sends (panic: send on closed channel). Instead we flip an atomic
// flag that gates new Enqueues and signal consumers via w.stop. Sends from
// handlers that slipped past the flag check land in the buffer (or hit the
// non-blocking default and drop) and are GC'd with the worker.
func (w *Worker) Stop() {
	w.once.Do(func() {
		w.stopped.Store(true)
		close(w.stop)
		w.wg.Wait()
		w.log.Info("visit worker stopped")
	})
}

// consume is the per-goroutine drain loop: it accumulates a batch and flushes
// either when the batch is full or when the flush ticker fires. Exits when
// stop is signalled, draining whatever is still buffered before returning.
func (w *Worker) consume() {
	defer w.wg.Done()

	batch := make([]domain.ProductVisit, 0, w.cfg.BatchSize)
	ticker := time.NewTicker(w.cfg.FlushInterval)
	defer ticker.Stop()

	flush := func() {
		if len(batch) == 0 {
			return
		}
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := w.repo.InsertBatch(ctx, batch); err != nil {
			w.log.Error("visit batch insert failed", "error", err, "batch_size", len(batch))
		}
		batch = batch[:0]
	}

	for {
		select {
		case v := <-w.ch:
			batch = append(batch, v)
			if len(batch) >= w.cfg.BatchSize {
				flush()
			}
		case <-ticker.C:
			flush()
		case <-w.stop:
			// Drain whatever's still buffered. Enqueue is gated by the atomic
			// flag at this point, so the channel won't grow further beyond
			// any in-flight handler that read stopped==false a moment ago.
			for {
				select {
				case v := <-w.ch:
					batch = append(batch, v)
				default:
					flush()
					return
				}
			}
		}
	}
}

// VisitorID derives a stable, privacy-preserving anonymous visitor identifier
// from IP + user-agent + a daily salt. The same browser visiting the same
// product on the same day will produce the same ID; the next day it rotates
// (so we count "unique daily visitors" without storing raw IPs).
func VisitorID(ip, userAgent string) string {
	day := time.Now().UTC().Format("2006-01-02")
	h := sha256.Sum256([]byte(ip + "|" + userAgent + "|" + day))
	return hex.EncodeToString(h[:16])
}

// ClientIP extracts the originating client IP from r, honoring X-Forwarded-For
// (first hop = client). Falls back to RemoteAddr.
func ClientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		first := strings.SplitN(xff, ",", 2)[0]
		return strings.TrimSpace(first)
	}
	if xr := r.Header.Get("X-Real-IP"); xr != "" {
		return strings.TrimSpace(xr)
	}
	if ip, _, err := net.SplitHostPort(r.RemoteAddr); err == nil {
		return ip
	}
	return r.RemoteAddr
}
