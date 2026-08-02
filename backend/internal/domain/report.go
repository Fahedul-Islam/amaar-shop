package domain

import (
	"errors"
	"time"
)

// ReportReason values map 1:1 with the CHECK constraint on shop_reports.reason.
type ReportReason string

const (
	ReportReasonCounterfeit  ReportReason = "counterfeit"
	ReportReasonScam         ReportReason = "scam"
	ReportReasonInappropriate ReportReason = "inappropriate"
	ReportReasonPoorQuality  ReportReason = "poor_quality"
	ReportReasonHarassment   ReportReason = "harassment"
	ReportReasonOther        ReportReason = "other"
)

// ValidReportReasons is the canonical allow-list for client-side dropdowns
// and server-side validation. Add to both places when expanding it.
var ValidReportReasons = []ReportReason{
	ReportReasonCounterfeit,
	ReportReasonScam,
	ReportReasonInappropriate,
	ReportReasonPoorQuality,
	ReportReasonHarassment,
	ReportReasonOther,
}

// IsValidReportReason returns true if the given string is a known reason.
func IsValidReportReason(r string) bool {
	for _, v := range ValidReportReasons {
		if string(v) == r {
			return true
		}
	}
	return false
}

// ReportStatus values. A new report starts as "open"; admins move it through
// "reviewing" → "resolved" or "dismissed".
type ReportStatus string

const (
	ReportStatusOpen      ReportStatus = "open"
	ReportStatusReviewing ReportStatus = "reviewing"
	ReportStatusResolved  ReportStatus = "resolved"
	ReportStatusDismissed ReportStatus = "dismissed"
)

// IsValidReportStatus returns true if the given string is a known status.
func IsValidReportStatus(s string) bool {
	switch ReportStatus(s) {
	case ReportStatusOpen, ReportStatusReviewing, ReportStatusResolved, ReportStatusDismissed:
		return true
	}
	return false
}

// ShopReport is one customer-submitted complaint about a shop.
// Reporter identity is optional — anonymous reports are allowed.
type ShopReport struct {
	ID            string       `json:"id"`
	ShopID        string       `json:"shop_id"`
	Reason        ReportReason `json:"reason"`
	Description   string       `json:"description"`
	ReporterName  string       `json:"reporter_name,omitempty"`
	ReporterPhone string       `json:"reporter_phone,omitempty"`
	Status        ReportStatus `json:"status"`
	AdminNote     string       `json:"admin_note,omitempty"`
	ResolvedBy    *string      `json:"resolved_by,omitempty"`
	ResolvedAt    *time.Time   `json:"resolved_at,omitempty"`
	CreatedAt     time.Time    `json:"created_at"`
}

// AdminReportRow is a ShopReport joined with shop info for the admin list.
type AdminReportRow struct {
	ShopReport
	ShopName string `json:"shop_name"`
	ShopSlug string `json:"shop_slug"`
}

// ReportListFilter is the standard filter shape for paginated admin report lists.
type ReportListFilter struct {
	Status   string
	ShopID   string
	Page     int
	PageSize int
}

// Offset returns the SQL offset for the given page/page_size.
func (f ReportListFilter) Offset() int {
	if f.Page < 1 {
		return 0
	}
	return (f.Page - 1) * f.PageSize
}

// CreateReportInput is the validated payload from a customer's report form.
type CreateReportInput struct {
	ShopSlug      string
	Reason        string
	Description   string
	ReporterName  string
	ReporterPhone string
}

var (
	ErrReportNotFound          = errors.New("report not found")
	ErrInvalidReportReason     = errors.New("invalid report reason")
	ErrInvalidReportStatus     = errors.New("invalid report status")
	ErrReportDescriptionTooShort = errors.New("description must be at least 10 characters")
	ErrReportDescriptionTooLong  = errors.New("description must be at most 2000 characters")
)
