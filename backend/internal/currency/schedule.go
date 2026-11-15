package currency

import "time"

// NextMidnight is the next 00:00 in Tashkent after the moment: the night's
// run waits for it. At midnight itself it is the next day's.
func NextMidnight(now time.Time) time.Time {
	return dayStart(now).AddDate(0, 0, 1)
}
