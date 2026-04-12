package order

import (
	"github.com/fhedul/amaarshop/backend/internal/config"
	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/handler/dto"
)

// Handler implements the public order endpoint.
type Handler struct {
	svc Service
	cfg *config.Config
}

func NewHandler(svc Service, cfg *config.Config) *Handler {
	return &Handler{svc: svc, cfg: cfg}
}



func toOrderDTO(o *domain.Order) dto.OrderDTO {
	items := make([]dto.OrderItemDTO, 0, len(o.Items))
	for _, it := range o.Items {
		items = append(items, dto.OrderItemDTO{
			ID:                   it.ID,
			ProductID:            it.ProductID,
			ProductNameSnapshot:  it.ProductNameSnapshot,
			UnitPriceSnapshotBDT: it.UnitPriceSnapshotBDT,
			Quantity:             it.Quantity,
			LineTotalBDT:         it.LineTotalBDT,
		})
	}
	return dto.OrderDTO{
		ID:                     o.ID,
		ShopID:                 o.ShopID,
		CustomerName:           o.CustomerName,
		CustomerPhone:          o.CustomerPhone,
		DeliveryAddress:        o.DeliveryAddress,
		DeliveryArea:           o.DeliveryArea,
		Note:                   o.Note,
		SubtotalBDT:            o.SubtotalBDT,
		DeliveryChargeBDT:      o.DeliveryChargeBDT,
		TotalBDT:               o.TotalBDT,
		Status:                 o.Status,
		AdvancePaymentRequired: o.AdvancePaymentRequired,
		AdvancePaymentReceived: o.AdvancePaymentReceived,
		CancelledReason:        o.CancelledReason,
		Items:                  items,
		CreatedAt:              o.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:              o.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}
