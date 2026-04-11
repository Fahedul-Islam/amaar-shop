package shop

import (
	"net/http"

	"github.com/fhedul/amaarshop/backend/internal/handler/dto"
	"github.com/fhedul/amaarshop/backend/internal/handler/http/middleware"
	"github.com/fhedul/amaarshop/backend/internal/handler/httputil"
	"github.com/fhedul/amaarshop/backend/internal/storage"
)

// UploadLogo handles POST /api/shops/me/logo.
func (h *Handler) UploadLogo(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	file, header, err := r.FormFile("file")
	if err != nil {
		httputil.WriteValidationError(w, "file field is required")
		return
	}
	defer file.Close()

	url, err := h.svc.UploadLogo(r.Context(), userID, file, header.Filename)
	if err != nil {
		if err == storage.ErrInvalidFileType || err == storage.ErrFileTooLarge {
			httputil.WriteValidationError(w, err.Error())
			return
		}
		httputil.WriteError(w, err)
		return
	}

	httputil.WriteJSON(w, http.StatusOK, dto.ImageUploadDTO{URL: url})
}

// UploadBanner handles POST /api/shops/me/banner.
func (h *Handler) UploadBanner(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	file, header, err := r.FormFile("file")
	if err != nil {
		httputil.WriteValidationError(w, "file field is required")
		return
	}
	defer file.Close()

	url, err := h.svc.UploadBanner(r.Context(), userID, file, header.Filename)
	if err != nil {
		if err == storage.ErrInvalidFileType || err == storage.ErrFileTooLarge {
			httputil.WriteValidationError(w, err.Error())
			return
		}
		httputil.WriteError(w, err)
		return
	}

	httputil.WriteJSON(w, http.StatusOK, dto.ImageUploadDTO{URL: url})
}
