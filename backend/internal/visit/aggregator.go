package visit

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"github.com/fhedul/amaarshop/backend/internal/repository"
)

// Aggregator runs a daily cron that rolls product_visits into product_visit_summary.
// It runs in-process (no external scheduler dependency) and is idempotent —
// re-running on the same day overwrites that day's summary rows.
type Aggregator struct {
	repo    repository.VisitRepository
	log     *slog.Logger
	hour    int
	minute  int
	stop    chan struct{}
	once    sync.Once
	stopped chan struct{}
}

// NewAggregator schedules aggregation at hour:minute UTC each day.
// 00:30 UTC is a sensible default — late enough that yesterday's visits are
// settled, early enough that the morning dashboard reads see fresh summaries.
func NewAggregator(repo repository.VisitRepository, log *slog.Logger, hour, minute int) *Aggregator {
	if log == nil {
		log = slog.Default()
	}
	return &Aggregator{
		repo:    repo,
		log:     log,
		hour:    hour,
		minute:  minute,
		stop:    make(chan struct{}),
		stopped: make(chan struct{}),
	}
}

// Start launches the cron loop. Returns immediately; the loop runs until Stop.
func (a *Aggregator) Start() {
	go a.loop()
	a.log.Info("visit aggregator started", "schedule_utc", a.scheduleString())
}

func (a *Aggregator) Stop() {
	a.once.Do(func() {
		close(a.stop)
		<-a.stopped
		a.log.Info("visit aggregator stopped")
	})
}

func (a *Aggregator) loop() {
	defer close(a.stopped)

	// On startup, aggregate today + yesterday so a server that was down
	// overnight still produces correct summaries.
	a.runOnce(time.Now().UTC().Add(-24 * time.Hour))
	a.runOnce(time.Now().UTC())

	for {
		next := a.nextRun()
		select {
		case <-time.After(time.Until(next)):
			// Aggregate yesterday (the day that just closed) + today (running totals).
			a.runOnce(time.Now().UTC().Add(-24 * time.Hour))
			a.runOnce(time.Now().UTC())
		case <-a.stop:
			return
		}
	}
}

func (a *Aggregator) runOnce(day time.Time) {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	n, err := a.repo.AggregateDay(ctx, day)
	if err != nil {
		a.log.Error("visit aggregation failed", "date", day.Format("2006-01-02"), "error", err)
		return
	}
	a.log.Info("visit aggregation completed", "date", day.Format("2006-01-02"), "rows_affected", n)
}

// nextRun returns the next UTC instant the cron should fire.
func (a *Aggregator) nextRun() time.Time {
	now := time.Now().UTC()
	candidate := time.Date(now.Year(), now.Month(), now.Day(), a.hour, a.minute, 0, 0, time.UTC)
	if !candidate.After(now) {
		candidate = candidate.Add(24 * time.Hour)
	}
	return candidate
}

func (a *Aggregator) scheduleString() string {
	return time.Date(0, 1, 1, a.hour, a.minute, 0, 0, time.UTC).Format("15:04")
}
