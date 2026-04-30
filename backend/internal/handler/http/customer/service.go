package customer

import (
	"context"

	"github.com/fhedul/amaarshop/backend/internal/domain"
)

// Service is the interface the customer handler depends on.
type Service interface {
	List(ctx context.Context, ownerUserID, segment, search, sort string, limit, offset int) ([]domain.Customer, int, error)
	Get(ctx context.Context, ownerUserID, phone string) (*domain.Customer, error)
	Orders(ctx context.Context, ownerUserID, phone string) ([]domain.CustomerOrderSummary, error)
	UpsertNote(ctx context.Context, ownerUserID, phone, note string) error
	DeleteNote(ctx context.Context, ownerUserID, phone string) error
	Analytics(ctx context.Context, ownerUserID string) (*domain.CustomerAnalytics, error)
}
