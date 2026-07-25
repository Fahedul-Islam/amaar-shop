package product

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/handler/dto"
	"github.com/fhedul/amaarshop/backend/internal/handler/http/middleware"
	"github.com/fhedul/amaarshop/backend/internal/handler/httputil"
	"github.com/fhedul/amaarshop/backend/internal/service"
)

// List handles GET /api/shops/me/products.
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	q := r.URL.Query()
	page, size := parsePagination(q.Get("page"), q.Get("page_size"))

	filter := domain.ProductFilter{
		Query:    strings.TrimSpace(q.Get("q")),
		Page:     page,
		PageSize: size,
	}
	if cat := q.Get("category_id"); cat != "" {
		filter.CategoryID = &cat
	}
	if v, ok := parseBool(q.Get("is_active")); ok {
		filter.IsActive = &v
	}
	// Default to non-archived for the seller view unless explicitly overridden.
	archived := false
	if raw := q.Get("is_archived"); raw != "" {
		if v, ok := parseBool(raw); ok {
			archived = v
		}
	}
	filter.IsArchived = &archived

	products, total, err := h.svc.ListProducts(r.Context(), userID, filter)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	out := make([]dto.ProductDTO, 0, len(products))
	for _, p := range products {
		out = append(out, toProductDTO(p))
	}
	httputil.WritePaginated(w, http.StatusOK, out, paginationDTO(page, size, total))
}

// Create handles POST /api/shops/me/products.
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	var req dto.CreateProductRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteValidationError(w, "invalid JSON body")
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	req.PriceBDT = strings.TrimSpace(req.PriceBDT)

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	in := service.CreateProductInput{
		Name:                  req.Name,
		Description:           req.Description,
		PriceBDT:              req.PriceBDT,
		CostPriceBDT:          req.CostPriceBDT,
		Stock:                 req.Stock,
		CategoryID:            req.CategoryID,
		IsActive:              isActive,
		DiscountType:          req.DiscountType,
		DiscountValue:         req.DiscountValue,
		DeliveryChargeDhaka:   req.DeliveryChargeDhaka,
		DeliveryChargeOutside: req.DeliveryChargeOutside,
	}

	p, err := h.svc.CreateProduct(r.Context(), userID, in)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	httputil.WriteJSON(w, http.StatusCreated, toProductDTO(p))
}

// Get handles GET /api/shops/me/products/{id}.
func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	id := r.PathValue("id")

	p, err := h.svc.GetProduct(r.Context(), userID, id)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, toProductDTO(p))
}

// Update handles PATCH /api/shops/me/products/{id}.
// A body field set to null clears the value (for CategoryID);
// an omitted field leaves the current value untouched.
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	id := r.PathValue("id")

	// Decode the raw body first so we can detect explicit null for category_id,
	// which the typed DTO cannot distinguish from "omitted".
	var raw map[string]json.RawMessage
	if err := json.NewDecoder(r.Body).Decode(&raw); err != nil {
		httputil.WriteValidationError(w, "invalid JSON body")
		return
	}

	in := service.UpdateProductInput{}

	if v, ok := raw["name"]; ok {
		var s string
		if err := json.Unmarshal(v, &s); err != nil {
			httputil.WriteValidationError(w, "name must be a string")
			return
		}
		s = strings.TrimSpace(s)
		in.Name = &s
	}
	if v, ok := raw["description"]; ok {
		var s string
		if err := json.Unmarshal(v, &s); err != nil {
			httputil.WriteValidationError(w, "description must be a string")
			return
		}
		in.Description = &s
	}
	if v, ok := raw["price_bdt"]; ok {
		var s string
		if err := json.Unmarshal(v, &s); err != nil {
			httputil.WriteValidationError(w, "price_bdt must be a string")
			return
		}
		s = strings.TrimSpace(s)
		in.PriceBDT = &s
	}
	// A null cost_price_bdt clears the cost; omitting it leaves it unchanged.
	if v, ok := raw["cost_price_bdt"]; ok {
		if string(v) == "null" {
			in.ClearCostPrice = true
		} else {
			var s string
			if err := json.Unmarshal(v, &s); err != nil {
				httputil.WriteValidationError(w, "cost_price_bdt must be a string")
				return
			}
			s = strings.TrimSpace(s)
			if s == "" {
				in.ClearCostPrice = true
			} else {
				in.CostPriceBDT = &s
			}
		}
	}
	if v, ok := raw["stock"]; ok {
		var n int
		if err := json.Unmarshal(v, &n); err != nil {
			httputil.WriteValidationError(w, "stock must be an integer")
			return
		}
		in.Stock = &n
	}
	if v, ok := raw["is_active"]; ok {
		var b bool
		if err := json.Unmarshal(v, &b); err != nil {
			httputil.WriteValidationError(w, "is_active must be a boolean")
			return
		}
		in.IsActive = &b
	}
	if v, ok := raw["category_id"]; ok {
		if string(v) == "null" {
			in.ClearCategory = true
		} else {
			var s string
			if err := json.Unmarshal(v, &s); err != nil {
				httputil.WriteValidationError(w, "category_id must be a string or null")
				return
			}
			if s == "" {
				in.ClearCategory = true
			} else {
				in.CategoryID = &s
			}
		}
	}
	// Discount fields: sending null clears discount.
	if v, ok := raw["discount_type"]; ok {
		if string(v) == "null" {
			in.ClearDiscount = true
		} else {
			var s string
			if err := json.Unmarshal(v, &s); err != nil {
				httputil.WriteValidationError(w, "discount_type must be a string or null")
				return
			}
			in.DiscountType = &s
		}
	}
	if v, ok := raw["discount_value"]; ok {
		if string(v) != "null" {
			var s string
			if err := json.Unmarshal(v, &s); err != nil {
				httputil.WriteValidationError(w, "discount_value must be a string or null")
				return
			}
			in.DiscountValue = &s
		}
	}
	// Delivery charge fields: sending null clears charges.
	if v, ok := raw["delivery_charge_dhaka"]; ok {
		if string(v) == "null" {
			in.ClearDeliveryCharges = true
		} else {
			var s string
			if err := json.Unmarshal(v, &s); err != nil {
				httputil.WriteValidationError(w, "delivery_charge_dhaka must be a string or null")
				return
			}
			in.DeliveryChargeDhaka = &s
		}
	}
	if v, ok := raw["delivery_charge_outside"]; ok {
		if string(v) != "null" {
			var s string
			if err := json.Unmarshal(v, &s); err != nil {
				httputil.WriteValidationError(w, "delivery_charge_outside must be a string or null")
				return
			}
			in.DeliveryChargeOutside = &s
		}
	}

	p, err := h.svc.UpdateProduct(r.Context(), userID, id, in)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, toProductDTO(p))
}

// Delete handles DELETE /api/shops/me/products/{id}.
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	id := r.PathValue("id")

	if err := h.svc.DeleteProduct(r.Context(), userID, id); err != nil {
		httputil.WriteError(w, err)
		return
	}
	httputil.WriteNoContent(w)
}

// Archive handles POST /api/shops/me/products/{id}/archive.
func (h *Handler) Archive(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	id := r.PathValue("id")

	p, err := h.svc.ArchiveProduct(r.Context(), userID, id)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, dto.ArchiveResponse{ID: p.ID, IsArchived: p.IsArchived})
}
