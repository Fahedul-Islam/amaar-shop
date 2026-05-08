package service

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"github.com/fhedul/amaarshop/backend/internal/repository"
)

// ReservationSweeper periodically expires past-due cart reservations and
// restores their held stock. It runs in-process so we don't need an
// external scheduler.
type ReservationSweeper struct {
	repo     repository.CartReservationRepository
	log      *slog.Logger
	interval time.Duration
	stop     chan struct{}
	stopped  chan struct{}
	once     sync.Once
}

// NewReservationSweeper creates a sweeper that ticks every interval.
// 60s is the default; finer granularity isn't useful because the buyer
// already sees a client-side countdown.
func NewReservationSweeper(
	repo repository.CartReservationRepository,
	log *slog.Logger,
	interval time.Duration,
) *ReservationSweeper {
	if log == nil {
		log = slog.Default()
	}
	if interval <= 0 {
		interval = time.Minute
	}
	return &ReservationSweeper{
		repo:     repo,
		log:      log,
		interval: interval,
		stop:     make(chan struct{}),
		stopped:  make(chan struct{}),
	}
}

// Start launches the loop. Returns immediately; the loop runs until Stop.
func (s *ReservationSweeper) Start() {
	go s.loop()
	s.log.Info("reservation sweeper started", "interval", s.interval)
}

func (s *ReservationSweeper) Stop() {
	s.once.Do(func() {
		close(s.stop)
		<-s.stopped
		s.log.Info("reservation sweeper stopped")
	})
}

func (s *ReservationSweeper) loop() {
	defer close(s.stopped)

	// Run an immediate sweep so a server restart doesn't leave stale
	// holds lingering until the next tick.
	s.sweep()

	t := time.NewTicker(s.interval)
	defer t.Stop()
	for {
		select {
		case <-s.stop:
			return
		case <-t.C:
			s.sweep()
		}
	}
}

func (s *ReservationSweeper) sweep() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	n, err := s.repo.SweepExpired(ctx)
	if err != nil {
		s.log.Error("reservation sweep failed", "error", err)
		return
	}
	if n > 0 {
		s.log.Info("expired reservations restored", "count", n)
	}
}
