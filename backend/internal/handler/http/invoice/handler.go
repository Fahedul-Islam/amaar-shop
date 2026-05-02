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
	"net/http"
	"strings"

	"github.com/fhedul/amaarshop/backend/internal/config"
	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/handler/http/middleware"
	"github.com/fhedul/amaarshop/backend/internal/handler/httputil"
	"github.com/fhedul/amaarshop/backend/internal/pdf"
)

// OrderService is the slice of the order service this handler needs.
type OrderService interface {
	LookupForCustomer(ctx context.Context, slug, orderID, customerPhone string) (*domain.Order, error)
	GetShopOrderByID(ctx context.Context, ownerID, orderID string) (*domain.Order, error)
	GetShopOrders(ctx context.Context, ownerID, page, size, status, phone string) ([]*domain.Order, error)
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
	orders   OrderService
	shops    ShopService
	products ProductService
	cfg      *config.Config
}

func NewHandler(orders OrderService, shops ShopService, products ProductService, cfg *config.Config) *Handler {
	return &Handler{orders: orders, shops: shops, products: products, cfg: cfg}
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

// SellerOrdersExport emits a PDF of the seller's orders, optionally
// filtered by ?status=&phone=&page=&page_size= (same params as the JSON list).
func (h *Handler) SellerOrdersExport(w http.ResponseWriter, r *http.Request) {
	ownerID := middleware.GetUserID(r.Context())
	q := r.URL.Query()

	// Default to a generous page size — seller exports are usually "all of it".
	size := q.Get("page_size")
	if size == "" {
		size = "500"
	}

	orders, err := h.orders.GetShopOrders(r.Context(), ownerID, q.Get("page"), size, q.Get("status"), q.Get("phone"))
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	shop, err := h.shops.GetMyShop(r.Context(), ownerID)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	bytes, err := pdf.BuildOrdersExport(pdf.OrdersExportData{
		Shop:   shop,
		Orders: orders,
		Status: q.Get("status"),
	})
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	writePDFBytes(w, "orders-"+shop.Slug+".pdf", bytes)
}

// SellerProductsExport emits a PDF of the seller's catalog (non-archived).
func (h *Handler) SellerProductsExport(w http.ResponseWriter, r *http.Request) {
	ownerID := middleware.GetUserID(r.Context())
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
	})
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	writePDFBytes(w, "products-"+shop.Slug+".pdf", bytes)
}

func shortRef(id string) string {
	if len(id) > 8 {
		return id[:8]
	}
	return id
}
