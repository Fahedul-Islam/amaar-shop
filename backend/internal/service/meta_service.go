package service

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/meta"
	"github.com/fhedul/amaarshop/backend/internal/repository"
)

// MetaService owns Conversions API settings and turns order events into queued
// conversions. Sending happens in MetaDispatcher; this layer only enqueues, so
// nothing in the buyer's request path ever waits on Meta.
type MetaService struct {
	shops  repository.ShopRepository
	orders repository.OrderRepository
	metaRepo repository.MetaRepository
}

func NewMetaService(
	shops repository.ShopRepository,
	orders repository.OrderRepository,
	metaRepo repository.MetaRepository,
) *MetaService {
	return &MetaService{shops: shops, orders: orders, metaRepo: metaRepo}
}

// GetSettings returns the shop's Meta configuration.
func (s *MetaService) GetSettings(ctx context.Context, ownerID string) (*domain.MetaSettings, error) {
	shop, err := s.shops.FindByOwnerID(ctx, ownerID)
	if err != nil {
		return nil, err
	}
	return s.metaRepo.GetSettings(ctx, shop.ID)
}

// UpdateMetaSettingsInput carries the seller's Events Manager credentials.
// Blank secrets keep the stored values, so the seller can toggle options
// without re-pasting their token.
type UpdateMetaSettingsInput struct {
	PixelID        string
	AccessToken    string
	IsEnabled      bool
	TrackDelivered bool
	TestEventCode  string
}

func (s *MetaService) UpdateSettings(ctx context.Context, ownerID string, in UpdateMetaSettingsInput) (*domain.MetaSettings, error) {
	shop, err := s.shops.FindByOwnerID(ctx, ownerID)
	if err != nil {
		return nil, err
	}
	existing, err := s.metaRepo.GetSettings(ctx, shop.ID)
	if err != nil {
		return nil, err
	}

	pixelID := strings.TrimSpace(in.PixelID)
	token := strings.TrimSpace(in.AccessToken)
	if pixelID == "" {
		pixelID = existing.PixelID
	}
	if token == "" {
		token = existing.AccessToken
	}
	if in.IsEnabled && pixelID == "" {
		return nil, domain.ErrInvalidPixelID
	}

	next := &domain.MetaSettings{
		ShopID:         shop.ID,
		PixelID:        pixelID,
		AccessToken:    token,
		IsEnabled:      in.IsEnabled,
		TrackDelivered: in.TrackDelivered,
		TestEventCode:  strings.TrimSpace(in.TestEventCode),
	}
	if err := s.metaRepo.UpsertSettings(ctx, next); err != nil {
		return nil, err
	}
	return s.metaRepo.GetSettings(ctx, shop.ID)
}

// PublishOrderEvent queues a conversion for an order. It is deliberately
// forgiving: shops without Meta configured are skipped silently, and any error
// is returned for logging rather than surfaced to the buyer — a tracking
// problem must never break checkout.
//
// eventName is meta.EventPurchase (order placed) or meta.EventDelivered
// (parcel accepted — the event worth optimising for under cash on delivery).
func (s *MetaService) PublishOrderEvent(ctx context.Context, order *domain.Order, eventName string) error {
	settings, err := s.metaRepo.GetSettings(ctx, order.ShopID)
	if err != nil {
		return err
	}
	if !settings.Active() {
		return nil
	}
	if eventName == meta.EventDelivered && !settings.TrackDelivered {
		return nil
	}

	// Value reported is what the buyer actually pays for goods; the delivery
	// fee is a courier cost, not revenue from the ad's perspective.
	value, _ := strconv.ParseFloat(order.SubtotalBDT, 64)

	firstName, lastName := splitName(order.CustomerName)
	matchFields := meta.MatchFieldCount(meta.UserData{
		Phone:      order.CustomerPhone,
		FirstName:  firstName,
		LastName:   lastName,
		City:       order.DeliveryDistrict,
		State:      order.DeliveryDivision,
		Country:    "bd",
		ExternalID: order.CustomerPhone,
	})

	orderID := order.ID
	return s.metaRepo.EnqueueEvent(ctx, &domain.MetaEvent{
		ShopID:  order.ShopID,
		OrderID: &orderID,
		EventName: eventName,
		// Stable per (order, event kind): makes enqueueing idempotent and lets
		// a browser pixel dedupe against the same conversion.
		EventID:     fmt.Sprintf("%s-%s", order.ID, strings.ToLower(eventName)),
		ValueBDT:    fmt.Sprintf("%.2f", value),
		MatchFields: matchFields,
		EventTime:   time.Now().UTC(),
	})
}

// TrackingStats reports conversion-tracking health for the period.
func (s *MetaService) TrackingStats(ctx context.Context, ownerID string, from, to time.Time) (*domain.TrackingStats, error) {
	shop, err := s.shops.FindByOwnerID(ctx, ownerID)
	if err != nil {
		return nil, err
	}
	stats, err := s.metaRepo.TrackingStats(ctx, shop.ID, from, to)
	if err != nil {
		return nil, err
	}
	settings, err := s.metaRepo.GetSettings(ctx, shop.ID)
	if err != nil {
		return nil, err
	}
	stats.Enabled = settings.IsEnabled
	stats.Configured = settings.Configured()
	return stats, nil
}

// RecentEvents lists the shop's latest conversion events.
func (s *MetaService) RecentEvents(ctx context.Context, ownerID string, limit int) ([]domain.MetaEvent, error) {
	shop, err := s.shops.FindByOwnerID(ctx, ownerID)
	if err != nil {
		return nil, err
	}
	if limit <= 0 || limit > 100 {
		limit = 25
	}
	return s.metaRepo.RecentEvents(ctx, shop.ID, limit)
}

// FunnelStats returns the shop's own views → orders → delivered funnel.
func (s *MetaService) FunnelStats(ctx context.Context, ownerID string, from, to time.Time) (*domain.FunnelStats, error) {
	shop, err := s.shops.FindByOwnerID(ctx, ownerID)
	if err != nil {
		return nil, err
	}
	return s.metaRepo.FunnelStats(ctx, shop.ID, from, to)
}

// splitName divides a full name into first and last parts. Many Bangladeshi
// buyers enter a single name, in which case the surname is left blank rather
// than duplicated (a wrong hash matches nobody and hurts match quality).
func splitName(full string) (first, last string) {
	parts := strings.Fields(strings.TrimSpace(full))
	switch len(parts) {
	case 0:
		return "", ""
	case 1:
		return parts[0], ""
	default:
		return parts[0], parts[len(parts)-1]
	}
}
