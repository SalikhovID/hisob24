// Package billing extends a company's paid period.
package billing

import "time"

// NewEndDate is a company's end date after paying for days more.
func NewEndDate(endDate, today time.Time, days int) time.Time {
	return endDate.AddDate(0, 0, days)
}
