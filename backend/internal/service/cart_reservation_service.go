package service

import (
	"context"
	"strings"
	"time"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/repository"
)

// CartReservationService is the buyer-facing API for cart holds.
type CartReservationService struct {
	shops    repository.ShopRepository
	products repository.ProductRepository
	reserves repository.CartReservationRepository
}

func NewCartReservationService(
	shops repository.ShopRepository,
	products repository.ProductRepository,
	reserves repository.CartReservationRepository,
) *CartReservationService {
	return &CartReservationService{
		shops:    shops,
		products: products,
		reserves: reserves,
	}
}

// ReserveItemInput mirrors the repository input shape so callers can stay
// service-layer-typed.
type ReserveItemInput struct {
	ProductID string
	Quantity  int
}

// CreateReservation places a hold on the requested products for
// domain.ReservationDuration. It validates the shop is reachable, then
// delegates to the repository which decrements stock atomically.
func (s *CartReservationService) CreateReservation(
	ctx context.Context,
	slug string,
	items []ReserveItemInput,
) (*domain.CartReservation, error) {
	shop, err := s.shops.FindBySlug(ctx, slug)
	if err != nil {
		return nil, err
	}
	if shop.IsSuspended {
		return nil, domain.ErrShopNotFound
	}

	if len(items) == 0 {
		return nil, domain.ErrEmptyReservation
	}
	repoItems := make([]repository.ReserveItemInput, 0, len(items))
	for _, in := range items {
		if in.ProductID == "" || in.Quantity <= 0 {
			return nil, domain.ErrEmptyReservation
		}
		repoItems = append(repoItems, repository.ReserveItemInput{
			ProductID: in.ProductID,
			Quantity:  in.Quantity,
		})
	}

	expires := time.Now().Add(domain.ReservationDuration)
	return s.reserves.Create(ctx, shop.ID, expires, repoItems)
}

// GetReservation returns a reservation if it belongs to the given shop.
// If the reservation is past its expires_at but still flagged active
// (the sweeper hasn't run yet), the caller is told it's expired so the
// UI doesn't show a stale countdown.
func (s *CartReservationService) GetReservation(
	ctx context.Context,
	slug, id string,
) (*domain.CartReservation, error) {
	shop, err := s.shops.FindBySlug(ctx, slug)
	if err != nil {
		return nil, err
	}
	res, err := s.reserves.Get(ctx, shop.ID, id)
	if err != nil {
		return nil, err
	}
	if res.Status == domain.ReservationStatusActive && time.Now().After(res.ExpiresAt) {
		// Don't lie to the caller — surface an expired status even if
		// the sweeper hasn't flipped the row yet.
		res.Status = domain.ReservationStatusExpired
	}
	return res, nil
}

// CancelReservation releases stock for an active reservation. Idempotent:
// returns success on already-non-active rows.
func (s *CartReservationService) CancelReservation(
	ctx context.Context,
	slug, id string,
) (*domain.CartReservation, error) {
	shop, err := s.shops.FindBySlug(ctx, slug)
	if err != nil {
		return nil, err
	}
	return s.reserves.Cancel(ctx, shop.ID, id)
}

// AttachPhone records the buyer's phone on the reservation so admins can
// see who held the inventory. Best-effort — errors are swallowed so a
// failure here can never block checkout.
func (s *CartReservationService) AttachPhone(
	ctx context.Context,
	id, phone string,
) {
	phone = strings.TrimSpace(phone)
	if id == "" || phone == "" {
		return
	}
	_ = s.reserves.AttachPhone(ctx, id, phone)
}
