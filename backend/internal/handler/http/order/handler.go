package order

import (
	"github.com/fhedul/amaarshop/backend/internal/config"
	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/handler/dto"
	"github.com/fhedul/amaarshop/backend/internal/storage"
)

// Handler implements the public order endpoint.
type Handler struct {
	svc       Service
	cfg       *config.Config
	fileStore storage.FileStorage
}

func NewHandler(svc Service, cfg *config.Config, fileStore storage.FileStorage) *Handler {
	return &Handler{svc: svc, cfg: cfg, fileStore: fileStore}
}

// toOrderDTO delegates to the shared mapper so seller and marketplace
// responses can never drift apart.
func toOrderDTO(o *domain.Order) dto.OrderDTO { return dto.ToOrderDTO(o) }
