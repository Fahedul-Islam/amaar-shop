// Package order contains HTTP handlers for the public order placement endpoint.
package order

import (
	"context"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/service"
)

// Service is the interface the order handler depends on.
type Service interface {
	PlaceOrder(ctx context.Context, slug string, in service.PlaceOrderInput) (*domain.Order, error)
}
