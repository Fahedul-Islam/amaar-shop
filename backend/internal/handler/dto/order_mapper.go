package dto

import "github.com/fhedul/amaarshop/backend/internal/domain"

// timeFormat is the single timestamp format used across order responses.
// It keeps the UTC offset rather than hard-coding "Z", so a server running in
// any timezone still reports an unambiguous instant.
const timeFormat = "2006-01-02T15:04:05Z07:00"

// ToOrderDTO converts a domain order into its API representation.
//
// It lives in the dto package because both the seller-facing order handler and
// the public marketplace handler need it; keeping one copy means a field added
// to the order (courier, tracking, ...) can never be returned by one endpoint
// and silently missing from the other.
func ToOrderDTO(o *domain.Order) OrderDTO {
	items := make([]OrderItemDTO, 0, len(o.Items))
	for _, it := range o.Items {
		items = append(items, OrderItemDTO{
			ID:                   it.ID,
			ProductID:            it.ProductID,
			ProductNameSnapshot:  it.ProductNameSnapshot,
			UnitPriceSnapshotBDT: it.UnitPriceSnapshotBDT,
			Quantity:             it.Quantity,
			LineTotalBDT:         it.LineTotalBDT,
		})
	}

	d := OrderDTO{
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
		CreatedAt:              o.CreatedAt.Format(timeFormat),
		UpdatedAt:              o.UpdatedAt.Format(timeFormat),
	}
	if o.AdvancePaymentSubmittedAt != nil {
		s := o.AdvancePaymentSubmittedAt.Format(timeFormat)
		d.AdvancePaymentSubmittedAt = &s
	}
	return d
}
