package pdf

import (
	"fmt"
	"strconv"

	"github.com/fhedul/amaarshop/backend/internal/domain"
)

// InvoiceData is everything needed to render a customer-facing invoice.
type InvoiceData struct {
	Order *domain.Order
	Shop  *domain.Shop
}

// BuildOrderInvoice renders a one-page invoice for a single order and
// returns the PDF bytes. Layout: header, "Bill to" + "Ship to" on the left,
// shop info on the right, items table, totals box, footer.
func BuildOrderInvoice(in InvoiceData) ([]byte, error) {
	d := New()
	short := shortRef(in.Order.ID)

	d.Header(
		"INVOICE",
		"#"+short+"  ·  "+formatDate(in.Order.CreatedAt),
	)

	d.H1(in.Shop.Name)
	d.Body(in.Shop.Description)

	d.Spacer(4)

	// Two-column "From" / "Ship to" layout.
	d.SectionTitle("FROM")
	d.Body(in.Shop.Name)
	if in.Shop.ContactPhone != "" {
		d.Body(in.Shop.ContactPhone)
	}
	d.Body("amaarshop.com/s/" + in.Shop.Slug)

	d.Spacer(2)

	d.SectionTitle("SHIP TO")
	d.Body(in.Order.CustomerName)
	d.Body(in.Order.CustomerPhone)
	if in.Order.DeliveryAddress != "" {
		d.Body(in.Order.DeliveryAddress)
	}
	if in.Order.DeliveryArea != "" {
		d.Body("Area: " + in.Order.DeliveryArea)
	}

	d.Spacer(4)

	// Order metadata block.
	d.KV("Order reference", "#"+short)
	d.KV("Placed on", formatDateTime(in.Order.CreatedAt))
	d.KV("Status", capitalize(in.Order.Status))
	if in.Order.AdvancePaymentRequired {
		paid := "not received"
		if in.Order.AdvancePaymentReceived {
			paid = "received"
		}
		d.KV("Advance payment", paid)
	}
	d.KV("Payment", "Cash on Delivery")

	d.Spacer(4)

	// Items table.
	rows := make([][]string, 0, len(in.Order.Items))
	for _, it := range in.Order.Items {
		rows = append(rows, []string{
			it.ProductNameSnapshot,
			strconv.Itoa(it.Quantity),
			"BDT " + it.UnitPriceSnapshotBDT,
			"BDT " + it.LineTotalBDT,
		})
	}
	d.Table([]Column{
		{Header: "Item", Width: 0, Align: "L"},
		{Header: "Qty", Width: 18, Align: "R"},
		{Header: "Price", Width: 32, Align: "R"},
		{Header: "Total", Width: 32, Align: "R"},
	}, rows)

	d.Spacer(4)

	// Totals.
	totals := [][]string{
		{"Subtotal", "BDT " + in.Order.SubtotalBDT},
		{"Delivery", "BDT " + in.Order.DeliveryChargeBDT},
		{"Total", "BDT " + in.Order.TotalBDT},
	}
	d.TotalsBlock(totals)

	d.Footer(
		fmt.Sprintf("Thank you for your order from %s", in.Shop.Name),
		"Need help? Contact the shop or visit amaarshop.com",
	)

	return d.Bytes()
}

// formatDate is "02 Jan 2006".
func formatDate(t interface{ Format(string) string }) string {
	return t.Format("02 Jan 2006")
}

// formatDateTime is "02 Jan 2006, 15:04".
func formatDateTime(t interface{ Format(string) string }) string {
	return t.Format("02 Jan 2006, 15:04")
}

// shortRef is the first 8 chars of a UUID — same form shown in admin tables.
func shortRef(id string) string {
	if len(id) > 8 {
		return id[:8]
	}
	return id
}

// capitalize uppercases the first byte of s. Sufficient for ASCII status names.
func capitalize(s string) string {
	if s == "" {
		return s
	}
	if s[0] >= 'a' && s[0] <= 'z' {
		return string(s[0]-32) + s[1:]
	}
	return s
}
