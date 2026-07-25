package service

import (
	"context"
	"log/slog"
	"strconv"
	"sync"
	"time"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/meta"
	"github.com/fhedul/amaarshop/backend/internal/repository"
)

// MetaMaxAttempts caps delivery retries for a transient failure before the
// event is parked as failed and surfaced in the seller's tracking stats.
const MetaMaxAttempts = 5

// MetaSender is the seam over the Conversions API client, so the dispatcher
// can be tested without network access.
type MetaSender interface {
	Send(ctx context.Context, pixelID, accessToken string, e meta.Event) (meta.Result, error)
}

// MetaDispatcher drains the conversion outbox and posts events to Meta.
//
// Delivery is deliberately out-of-band: the checkout path only writes a row, so
// a slow or failing Meta API can never delay a buyer or lose a conversion to a
// server restart — pending rows are simply picked up on the next pass.
type MetaDispatcher struct {
	repo      repository.MetaRepository
	orders    repository.OrderRepository
	sender    MetaSender
	log       *slog.Logger
	interval  time.Duration
	batchSize int
	stop      chan struct{}
	stopped   chan struct{}
	once      sync.Once
}

func NewMetaDispatcher(
	repo repository.MetaRepository,
	orders repository.OrderRepository,
	sender MetaSender,
	log *slog.Logger,
	interval time.Duration,
) *MetaDispatcher {
	if log == nil {
		log = slog.Default()
	}
	if interval <= 0 {
		interval = 30 * time.Second
	}
	return &MetaDispatcher{
		repo:      repo,
		orders:    orders,
		sender:    sender,
		log:       log,
		interval:  interval,
		batchSize: 50,
		stop:      make(chan struct{}),
		stopped:   make(chan struct{}),
	}
}

func (d *MetaDispatcher) Start() {
	go d.loop()
	d.log.Info("meta conversions dispatcher started", "interval", d.interval)
}

func (d *MetaDispatcher) Stop() {
	d.once.Do(func() {
		close(d.stop)
		<-d.stopped
		d.log.Info("meta conversions dispatcher stopped")
	})
}

func (d *MetaDispatcher) loop() {
	defer close(d.stopped)

	t := time.NewTicker(d.interval)
	defer t.Stop()
	for {
		select {
		case <-d.stop:
			return
		case <-t.C:
			d.dispatch()
		}
	}
}

// dispatch delivers one batch of pending events.
func (d *MetaDispatcher) dispatch() {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	events, err := d.repo.ClaimPending(ctx, d.batchSize)
	if err != nil {
		d.log.Error("meta dispatch: claim failed", "error", err)
		return
	}
	if len(events) == 0 {
		return
	}

	// Settings are per shop; cache them for the batch so a burst of orders
	// from one shop doesn't re-read the same row repeatedly.
	settingsCache := map[string]*domain.MetaSettings{}
	sent, failed := 0, 0

	for i := range events {
		e := events[i]

		settings, ok := settingsCache[e.ShopID]
		if !ok {
			settings, err = d.repo.GetSettings(ctx, e.ShopID)
			if err != nil {
				d.log.Error("meta dispatch: settings lookup failed", "shop_id", e.ShopID, "error", err)
				continue
			}
			settingsCache[e.ShopID] = settings
		}
		// The seller disabled tracking after the event was queued — drop it
		// rather than retrying forever.
		if !settings.Active() {
			_ = d.repo.MarkFailed(ctx, e.ID, "Meta tracking is turned off for this shop", false, MetaMaxAttempts)
			continue
		}

		event, err := d.buildEvent(ctx, e, settings)
		if err != nil {
			_ = d.repo.MarkFailed(ctx, e.ID, err.Error(), false, MetaMaxAttempts)
			failed++
			continue
		}

		if _, err := d.sender.Send(ctx, settings.PixelID, settings.AccessToken, event); err != nil {
			retryable := false
			if apiErr, ok := err.(*meta.APIError); ok {
				retryable = apiErr.Retryable
			}
			_ = d.repo.MarkFailed(ctx, e.ID, err.Error(), retryable, MetaMaxAttempts)
			failed++
			continue
		}
		if err := d.repo.MarkSent(ctx, e.ID); err != nil {
			d.log.Error("meta dispatch: mark sent failed", "event_id", e.ID, "error", err)
		}
		sent++
	}

	if sent > 0 || failed > 0 {
		d.log.Info("meta conversions dispatched", "sent", sent, "failed", failed)
	}
}

// buildEvent rehydrates the buyer's identifiers from the order. They are never
// stored on the queue row — only the count of them — so no personal data sits
// duplicated in the outbox.
func (d *MetaDispatcher) buildEvent(ctx context.Context, e domain.MetaEvent, settings *domain.MetaSettings) (meta.Event, error) {
	value, _ := strconv.ParseFloat(e.ValueBDT, 64)
	event := meta.Event{
		Name:          e.EventName,
		EventID:       e.EventID,
		EventTime:     e.EventTime,
		Value:         value,
		Currency:      "BDT",
		TestEventCode: settings.TestEventCode,
	}
	if e.OrderID == nil {
		return event, nil
	}

	order, err := d.orders.OrderByID(ctx, *e.OrderID)
	if err != nil {
		return meta.Event{}, err
	}
	if err := d.orders.LoadItems(ctx, order); err != nil {
		return meta.Event{}, err
	}
	first, last := splitName(order.CustomerName)
	contentIDs := make([]string, 0, len(order.Items))
	for _, it := range order.Items {
		contentIDs = append(contentIDs, it.ProductID)
	}
	event.OrderID = order.ID
	event.ContentIDs = contentIDs
	event.User = meta.UserData{
		Phone:      order.CustomerPhone,
		FirstName:  first,
		LastName:   last,
		City:       order.DeliveryDistrict,
		State:      order.DeliveryDivision,
		Country:    "bd",
		ExternalID: order.CustomerPhone,
	}
	return event, nil
}
