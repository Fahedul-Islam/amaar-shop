// Package invoice exposes the customer-facing PDF invoice download endpoint.
//
// Two flavors:
//   - Public download (phone-gated, like the order lookup): customers visit
//     the order confirmation / lookup page and grab their invoice without
//     needing an account.
//   - Seller download (auth-gated): shop owners can re-download any of
//     their own orders' invoices.
package invoice

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/fhedul/amaarshop/backend/internal/config"
	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/handler/http/middleware"
	"github.com/fhedul/amaarshop/backend/internal/handler/httputil"
	"github.com/fhedul/amaarshop/backend/internal/pdf"
)

var (
	errBadRange    = errors.New("from date must be on or before to date")
	errRangeTooBig = errors.New("date range must not exceed 366 days")
)

func errInvalidDate(field string) error {
	return errors.New(field + " must be a valid YYYY-MM-DD date")
}

// OrderService is the slice of the order service this handler needs.
type OrderService interface {
	LookupForCustomer(ctx context.Context, slug, orderID, customerPhone string) (*domain.Order, error)
	GetShopOrderByID(ctx context.Context, ownerID, orderID string) (*domain.Order, error)
	GetShopOrders(ctx context.Context, ownerID, page, size, status, phone string) ([]*domain.Order, error)
}

// AnalyticsService is the slice of the analytics service used to build
// the seller-side order/product report bodies.
type AnalyticsService interface {
	OrderReport(ctx context.Context, ownerUserID string, from, to time.Time) (*domain.OrderReport, error)
	ProductReport(ctx context.Context, ownerUserID string, from, to time.Time) (*domain.ProductReport, error)
}

// ShopService is the slice of the shop service this handler needs.
type ShopService interface {
	GetMyShop(ctx context.Context, ownerUserID string) (*domain.Shop, error)
	GetPublicShop(ctx context.Context, slug string) (*domain.Shop, error)
}

// ProductService is the slice of the product service used for the catalog
// export.
type ProductService interface {
	ListProducts(ctx context.Context, ownerUserID string, filter domain.ProductFilter) ([]*domain.Product, int, error)
}

type Handler struct {
	orders    OrderService
	shops     ShopService
	products  ProductService
	analytics AnalyticsService
	cfg       *config.Config
}

func NewHandler(orders OrderService, shops ShopService, products ProductService, analytics AnalyticsService, cfg *config.Config) *Handler {
	return &Handler{orders: orders, shops: shops, products: products, analytics: analytics, cfg: cfg}
}

// RegisterRoutes mounts the invoice download endpoints.
//
// The customer endpoint takes the phone via query string (?phone=01XXX) so
// the click target is a plain anchor — no form/JS needed for the simplest
// "right-click → save as" flow.
func (h *Handler) RegisterRoutes(mux *http.ServeMux, mw *middleware.Manager) {
	auth := mw.With(middleware.Auth(h.cfg.JWTSecret))

	mux.HandleFunc("GET /api/shops/by-slug/{slug}/orders/{id}/invoice.pdf", h.CustomerInvoice)
	mux.HandleFunc("GET /api/shops/me/orders/{id}/invoice.pdf", auth.Then(h.SellerInvoice))

	// Seller bulk PDF exports.
	mux.HandleFunc("GET /api/shops/me/exports/orders.pdf", auth.Then(h.SellerOrdersExport))
	mux.HandleFunc("GET /api/shops/me/exports/products.pdf", auth.Then(h.SellerProductsExport))
}

// CustomerInvoice serves the PDF invoice if the customer can prove ownership
// by submitting the phone number on the order. Same auth model as the order
// lookup endpoint — anyone with the order id + the phone gets in.
func (h *Handler) CustomerInvoice(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	orderID := r.PathValue("id")
	phone := strings.TrimSpace(r.URL.Query().Get("phone"))

	if phone == "" {
		httputil.WriteValidationError(w, "phone query parameter is required")
		return
	}

	order, err := h.orders.LookupForCustomer(r.Context(), slug, orderID, phone)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	shop, err := h.shops.GetPublicShop(r.Context(), slug)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	h.servePDF(w, order, shop)
}

// SellerInvoice serves the PDF invoice for one of the seller's own orders.
func (h *Handler) SellerInvoice(w http.ResponseWriter, r *http.Request) {
	ownerID := middleware.GetUserID(r.Context())
	orderID := r.PathValue("id")

	order, err := h.orders.GetShopOrderByID(r.Context(), ownerID, orderID)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	shop, err := h.shops.GetMyShop(r.Context(), ownerID)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	h.servePDF(w, order, shop)
}

// servePDF builds the PDF and writes it with the right content-disposition
// so the browser triggers a download with a sensible filename.
func (h *Handler) servePDF(w http.ResponseWriter, order *domain.Order, shop *domain.Shop) {
	bytes, err := pdf.BuildOrderInvoice(pdf.InvoiceData{Order: order, Shop: shop})
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	filename := "invoice-" + shortRef(order.ID) + ".pdf"
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", `attachment; filename="`+filename+`"`)
	w.Header().Set("Cache-Control", "no-store")
	_, _ = w.Write(bytes)
}

// writePDFBytes is the file-export equivalent of servePDF: same headers,
// caller-provided filename + bytes.
func writePDFBytes(w http.ResponseWriter, filename string, bytes []byte) {
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", `attachment; filename="`+filename+`"`)
	w.Header().Set("Cache-Control", "no-store")
	_, _ = w.Write(bytes)
}

// SellerOrdersExport emits the seller's order analytics PDF for the given
// date range (?from=&to=, both YYYY-MM-DD). Defaults to last 30 days when
// either bound is missing. Optional ?status= filter narrows the order list
// printed at the bottom of the report.
func (h *Handler) SellerOrdersExport(w http.ResponseWriter, r *http.Request) {
	ownerID := middleware.GetUserID(r.Context())
	q := r.URL.Query()

	from, to, err := parseRange(q.Get("from"), q.Get("to"))
	if err != nil {
		httputil.WriteValidationError(w, err.Error())
		return
	}

	report, err := h.analytics.OrderReport(r.Context(), ownerID, from, to)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	// Order list — filtered by status if provided. We pull a generous page so
	// the table reflects the full window; sellers rarely have >1000 orders/window.
	orders, err := h.orders.GetShopOrders(r.Context(), ownerID, "", "1000", q.Get("status"), "")
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	// Trim to the date window.
	orders = filterOrdersByRange(orders, from, to)

	shop, err := h.shops.GetMyShop(r.Context(), ownerID)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	bytes, err := pdf.BuildOrdersExport(pdf.OrdersExportData{
		Shop:   shop,
		Orders: orders,
		Report: report,
		Status: q.Get("status"),
	})
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	writePDFBytes(w, "orders-"+shop.Slug+"-"+from.Format("20060102")+"-"+to.Format("20060102")+".pdf", bytes)
}

// SellerProductsExport emits the seller's product analytics PDF for the given
// date range (?from=&to=, YYYY-MM-DD). Inventory counts are point-in-time;
// sales numbers are scoped to the window. Defaults to last 30 days.
func (h *Handler) SellerProductsExport(w http.ResponseWriter, r *http.Request) {
	ownerID := middleware.GetUserID(r.Context())
	q := r.URL.Query()

	from, to, err := parseRange(q.Get("from"), q.Get("to"))
	if err != nil {
		httputil.WriteValidationError(w, err.Error())
		return
	}

	report, err := h.analytics.ProductReport(r.Context(), ownerID, from, to)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	notArchived := false
	products, _, err := h.products.ListProducts(r.Context(), ownerID, domain.ProductFilter{
		IsArchived: &notArchived,
		PageSize:   500,
	})
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	shop, err := h.shops.GetMyShop(r.Context(), ownerID)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	bytes, err := pdf.BuildProductsExport(pdf.ProductsExportData{
		Shop:     shop,
		Products: products,
		Report:   report,
	})
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	writePDFBytes(w, "products-"+shop.Slug+"-"+from.Format("20060102")+"-"+to.Format("20060102")+".pdf", bytes)
}

// parseRange interprets the from/to query params as YYYY-MM-DD dates.
// Either bound may be omitted; missing bounds default to a last-30-day window.
// `from` must not be after `to`, and the window cannot exceed 366 days.
func parseRange(fromS, toS string) (time.Time, time.Time, error) {
	const layout = "2006-01-02"
	now := time.Now().UTC()
	to := now
	from := now.AddDate(0, 0, -29)

	if toS != "" {
		t, err := time.Parse(layout, toS)
		if err != nil {
			return time.Time{}, time.Time{}, errInvalidDate("to")
		}
		to = t
	}
	if fromS != "" {
		t, err := time.Parse(layout, fromS)
		if err != nil {
			return time.Time{}, time.Time{}, errInvalidDate("from")
		}
		from = t
	}
	if from.After(to) {
		return time.Time{}, time.Time{}, errBadRange
	}
	if to.Sub(from).Hours() > 366*24 {
		return time.Time{}, time.Time{}, errRangeTooBig
	}
	return from, to, nil
}

func filterOrdersByRange(orders []*domain.Order, from, to time.Time) []*domain.Order {
	end := to.AddDate(0, 0, 1) // inclusive on `to`
	out := make([]*domain.Order, 0, len(orders))
	for _, o := range orders {
		if (o.CreatedAt.Equal(from) || o.CreatedAt.After(from)) && o.CreatedAt.Before(end) {
			out = append(out, o)
		}
	}
	return out
}

func shortRef(id string) string {
	if len(id) > 8 {
		return id[:8]
	}
	return id
}
