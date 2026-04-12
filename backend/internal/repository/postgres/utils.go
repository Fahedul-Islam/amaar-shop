package postgres

import "strconv"

func paginationParams(page, size string) (limit, offset int) {
	p, err := strconv.Atoi(page)
	if err != nil || p < 1 {
		p = 1
	}
	s, err := strconv.Atoi(size)
	if err != nil || s < 1 {
		s = 10
	}
	return s, (p - 1) * s
}
