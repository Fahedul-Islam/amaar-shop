package service

import (
	"context"
	"strings"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/repository"
)

// CustomerService is the seller-facing customer-management service. It
// translates owner-user IDs to shop IDs and forwards filtered queries to
// the customer repository.
type CustomerService struct {
	shops     repository.ShopRepository
	customers repository.CustomerRepository
}

func NewCustomerService(shops repository.ShopRepository, customers repository.CustomerRepository) *CustomerService {
	return &CustomerService{shops: shops, customers: customers}
}

// NormalizePhone collapses any phone format the buyer entered down to the
// last 11 digits — matches the SQL-side normalize_phone() function so
// round-trips between handler and DB stay consistent.
func NormalizePhone(p string) string {
	digits := make([]byte, 0, len(p))
	for i := 0; i < len(p); i++ {
		c := p[i]
		if c >= '0' && c <= '9' {
			digits = append(digits, c)
		}
	}
	if len(digits) > 11 {
		digits = digits[len(digits)-11:]
	}
	return string(digits)
}

func (s *CustomerService) List(
	ctx context.Context,
	ownerUserID string,
	segment string,
	search string,
	sort string,
	limit, offset int,
) ([]domain.Customer, int, error) {
	shop, err := s.shops.FindByOwnerID(ctx, ownerUserID)
	if err != nil {
		return nil, 0, err
	}

	f := domain.CustomerListFilters{
		Search: strings.TrimSpace(search),
		Sort:   sort,
		Limit:  limit,
		Offset: offset,
	}
	if segment != "" {
		if !domain.IsValidCustomerSegment(segment) {
			return nil, 0, domain.ErrInvalidPhone // reuse a 400-class err; segment is an input
		}
		f.Segment = domain.CustomerSegment(segment)
	}
	return s.customers.List(ctx, shop.ID, f)
}

func (s *CustomerService) Get(ctx context.Context, ownerUserID, phone string) (*domain.Customer, error) {
	shop, err := s.shops.FindByOwnerID(ctx, ownerUserID)
	if err != nil {
		return nil, err
	}
	normalized := NormalizePhone(phone)
	if normalized == "" {
		return nil, domain.ErrInvalidPhone
	}
	return s.customers.Get(ctx, shop.ID, normalized)
}

func (s *CustomerService) Orders(ctx context.Context, ownerUserID, phone string) ([]domain.CustomerOrderSummary, error) {
	shop, err := s.shops.FindByOwnerID(ctx, ownerUserID)
	if err != nil {
		return nil, err
	}
	normalized := NormalizePhone(phone)
	if normalized == "" {
		return nil, domain.ErrInvalidPhone
	}
	return s.customers.Orders(ctx, shop.ID, normalized)
}

func (s *CustomerService) UpsertNote(ctx context.Context, ownerUserID, phone, note string) error {
	shop, err := s.shops.FindByOwnerID(ctx, ownerUserID)
	if err != nil {
		return err
	}
	normalized := NormalizePhone(phone)
	if normalized == "" {
		return domain.ErrInvalidPhone
	}
	// Verify the customer actually exists for this shop. Without this, a
	// seller could write notes against arbitrary phone numbers — harmless
	// today but pollutes the table and lets storage grow unbounded.
	if _, err := s.customers.Get(ctx, shop.ID, normalized); err != nil {
		return err
	}
	return s.customers.UpsertNote(ctx, shop.ID, normalized, strings.TrimSpace(note))
}

func (s *CustomerService) DeleteNote(ctx context.Context, ownerUserID, phone string) error {
	shop, err := s.shops.FindByOwnerID(ctx, ownerUserID)
	if err != nil {
		return err
	}
	normalized := NormalizePhone(phone)
	if normalized == "" {
		return domain.ErrInvalidPhone
	}
	return s.customers.DeleteNote(ctx, shop.ID, normalized)
}

func (s *CustomerService) Analytics(ctx context.Context, ownerUserID string) (*domain.CustomerAnalytics, error) {
	shop, err := s.shops.FindByOwnerID(ctx, ownerUserID)
	if err != nil {
		return nil, err
	}
	return s.customers.Analytics(ctx, shop.ID)
}
