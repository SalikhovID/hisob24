// Package billing extends a company's paid period.
package billing

import "time"

// NewEndDate is a company's end date after paying for days more: the paid
// days follow the current end date, or start today once that has passed
// (GREATEST(end_date, CURRENT_DATE) + days).
func NewEndDate(endDate, today time.Time, days int) time.Time {
	start := endDate
	if today.After(endDate) {
		start = today
	}
	return start.AddDate(0, 0, days)
}
