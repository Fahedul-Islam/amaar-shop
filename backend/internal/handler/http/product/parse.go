package product

import "strconv"

// parseInt wraps strconv.Atoi so the handler files don't each import strconv.
func parseInt(s string) (int, error) {
	return strconv.Atoi(s)
}

// parseBool returns (value, true) if s is a valid bool, else (_, false).
func parseBool(s string) (bool, bool) {
	b, err := strconv.ParseBool(s)
	if err != nil {
		return false, false
	}
	return b, true
}
