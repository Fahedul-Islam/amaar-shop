package service

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/repository"
)

// DefaultBackfillDays bounds how far back the filler will create rows. It
// keeps a restart after downtime cheap while still covering a long outage.
const DefaultBackfillDays = 30

// AdSpendFiller materialises daily ad-spend rows from each shop's recurring
// budget, so sellers with a steady daily spend never have to type it in.
//
// The underlying insert is idempotent (ON CONFLICT DO NOTHING), so ticking
// often is harmless and a seller's own figure is never overwritten. Ticking
// hourly rather than daily means a shop that sets a budget mid-day, or a
// server that was down at midnight, still gets today's row promptly.
type AdSpendFiller struct {
	repo     repository.MarketingRepository
	log      *slog.Logger
	interval time.Duration
	stop     chan struct{}
	stopped  chan struct{}
	once     sync.Once
}

func NewAdSpendFiller(
	repo repository.MarketingRepository,
	log *slog.Logger,
	interval time.Duration,
) *AdSpendFiller {
	if log == nil {
		log = slog.Default()
	}
	if interval <= 0 {
		interval = time.Hour
	}
	return &AdSpendFiller{
		repo:     repo,
		log:      log,
		interval: interval,
		stop:     make(chan struct{}),
		stopped:  make(chan struct{}),
	}
}

// Start launches the loop. Returns immediately; the loop runs until Stop.
func (f *AdSpendFiller) Start() {
	go f.loop()
	f.log.Info("ad spend filler started", "interval", f.interval)
}

func (f *AdSpendFiller) Stop() {
	f.once.Do(func() {
		close(f.stop)
		<-f.stopped
		f.log.Info("ad spend filler stopped")
	})
}

func (f *AdSpendFiller) loop() {
	defer close(f.stopped)

	// Fill immediately on boot so a restart catches up any missed days.
	f.fill()

	t := time.NewTicker(f.interval)
	defer t.Stop()
	for {
		select {
		case <-f.stop:
			return
		case <-t.C:
			f.fill()
		}
	}
}

func (f *AdSpendFiller) fill() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// "Today" is the seller's today in Bangladesh, not the server's UTC day.
	n, err := f.repo.FillEstimatedSpend(ctx, domain.TodayBD(), DefaultBackfillDays)
	if err != nil {
		f.log.Error("ad spend fill failed", "error", err)
		return
	}
	if n > 0 {
		f.log.Info("estimated ad spend rows created", "count", n)
	}
}
