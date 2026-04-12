package product

import (
	"encoding/json"
	"net/http"

	"github.com/fhedul/amaarshop/backend/internal/handler/dto"
	"github.com/fhedul/amaarshop/backend/internal/handler/http/middleware"
	"github.com/fhedul/amaarshop/backend/internal/handler/httputil"
	"github.com/fhedul/amaarshop/backend/internal/storage"
)

// UploadImage handles POST /api/shops/me/products/{id}/images.
func (h *Handler) UploadImage(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	productID := r.PathValue("id")

	file, header, err := r.FormFile("file")
	if err != nil {
		httputil.WriteValidationError(w, "file field is required")
		return
	}
	defer file.Close()

	img, err := h.svc.UploadImage(r.Context(), userID, productID, file, header.Filename)
	if err != nil {
		if err == storage.ErrInvalidFileType || err == storage.ErrFileTooLarge {
			httputil.WriteValidationError(w, err.Error())
			return
		}
		httputil.WriteError(w, err)
		return
	}
	httputil.WriteJSON(w, http.StatusCreated, toImageDTO(*img))
}

// DeleteImage handles DELETE /api/shops/me/products/{id}/images/{imageID}.
func (h *Handler) DeleteImage(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	productID := r.PathValue("id")
	imageID := r.PathValue("imageID")

	if err := h.svc.DeleteImage(r.Context(), userID, productID, imageID); err != nil {
		httputil.WriteError(w, err)
		return
	}
	httputil.WriteNoContent(w)
}

// ReorderImages handles PATCH /api/shops/me/products/{id}/images/reorder.
func (h *Handler) ReorderImages(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	productID := r.PathValue("id")

	var req dto.ReorderImagesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteValidationError(w, "invalid JSON body")
		return
	}
	if len(req.ImageIDs) == 0 {
		httputil.WriteValidationError(w, "image_ids is required")
		return
	}

	images, err := h.svc.ReorderImages(r.Context(), userID, productID, req.ImageIDs)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	out := make([]dto.ProductImageDTO, 0, len(images))
	for _, img := range images {
		out = append(out, toImageDTO(*img))
	}
	httputil.WriteJSON(w, http.StatusOK, out)
}
