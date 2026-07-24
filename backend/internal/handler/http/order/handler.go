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
	d := dto.OrderDTO{
		ID:                     o.ID,
		ShopID:                 o.ShopID,
		CustomerName:           o.CustomerName,
		CustomerPhone:          o.CustomerPhone,
		DeliveryAddress:        o.DeliveryAddress,
		DeliveryDivision:       o.DeliveryDivision,
		DeliveryDistrict:       o.DeliveryDistrict,
		Note:                   o.Note,
		SubtotalBDT:            o.SubtotalBDT,
		DeliveryChargeBDT:      o.DeliveryChargeBDT,
		TotalBDT:               o.TotalBDT,
		Status:                 o.Status,
		CourierName:            o.CourierName,
		TrackingID:             o.TrackingID,
		AdvancePaymentRequired: o.AdvancePaymentRequired,
		AdvancePaymentReceived: o.AdvancePaymentReceived,
		AdvancePaymentMethodID: o.AdvancePaymentMethodID,
		AdvancePaymentTxnRef:   o.AdvancePaymentTxnRef,
		AdvancePaymentReceipt:  o.AdvancePaymentReceipt,
		CancelledReason:        o.CancelledReason,
		Items:                  items,
		CreatedAt:              o.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:              o.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
	if o.AdvancePaymentSubmittedAt != nil {
		s := o.AdvancePaymentSubmittedAt.Format("2006-01-02T15:04:05Z07:00")
		d.AdvancePaymentSubmittedAt = &s
	}
	return d
}
