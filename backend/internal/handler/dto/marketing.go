package dto

// RecordAdSpendRequest is the body for POST /api/shops/me/ad-spend.
// Re-posting the same date+platform overwrites that entry.
type RecordAdSpendRequest struct {
	SpendDate string `json:"spend_date"` // YYYY-MM-DD
	Platform  string `json:"platform"`   // facebook | tiktok | instagram | google | other
	AmountBDT string `json:"amount_bdt"`
	Note      string `json:"note"`
}

// SetAdBudgetRequest is the body for PUT /api/shops/me/ad-budgets.
// A recurring daily amount that the platform fills in automatically.
type SetAdBudgetRequest struct {
	Platform       string `json:"platform"`
	DailyAmountBDT string `json:"daily_amount_bdt"`
	IsActive       bool   `json:"is_active"`
}
