package httputil

import (
	"net/http"
	"time"

	"github.com/fhedul/amaarshop/backend/internal/domain"
)

// ParseDateRange reads ?from=&to= (YYYY-MM-DD) from the request as Bangladesh
// dates, defaulting to the last 30 days.
//
// Dates are interpreted in Dhaka time rather than UTC because every consumer is
// a seller-facing report: between midnight and 6am local time a UTC "today"
// still points at yesterday, which would silently exclude the seller's most
// recent data. Both bounds are inclusive; the returned values are start-of-day
// instants.
func ParseDateRange(r *http.Request) (from, to time.Time, ok bool) {
	now := time.Now().In(domain.BDLocation)
	to = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, domain.BDLocation)
	from = to.AddDate(0, 0, -29)

	if v := r.URL.Query().Get("from"); v != "" {
		parsed, err := time.ParseInLocation("2006-01-02", v, domain.BDLocation)
		if err != nil {
			return time.Time{}, time.Time{}, false
		}
		from = parsed
	}
	if v := r.URL.Query().Get("to"); v != "" {
		parsed, err := time.ParseInLocation("2006-01-02", v, domain.BDLocation)
		if err != nil {
			return time.Time{}, time.Time{}, false
		}
		to = parsed
	}
	if to.Before(from) {
		return time.Time{}, time.Time{}, false
	}
	return from, to, true
}
