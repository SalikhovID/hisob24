package billing

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func day(s string) time.Time {
	d, err := time.Parse(time.DateOnly, s)
	if err != nil {
		panic(err)
	}
	return d
}

func TestNewEndDate(t *testing.T) {
	today := day("2026-10-02")
	tests := []struct {
		name    string
		endDate time.Time
		days    int
		want    time.Time
	}{
		{"not expired: the days follow the end date", day("2026-10-20"), 30, day("2026-11-19")},
		{"ends today: still counts from the end date", day("2026-10-02"), 1, day("2026-10-03")},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, NewEndDate(tt.endDate, today, tt.days))
		})
	}
}
