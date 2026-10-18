package order

import (
	"strings"
	"time"

	"github.com/SalikhovID/hisob24/backend/internal/fields"
	"github.com/SalikhovID/hisob24/backend/internal/warehouse"
)

// orderDeadline is an order's deadline as a client sends it: a day written as
// YYYY-MM-DD. A day that is past is taken too: an order may be late already.
func orderDeadline(raw string) (time.Time, error) {
	if strings.TrimSpace(raw) == "" {
		return time.Time{}, invalid("Muddatni kiriting")
	}
	day, err := time.Parse(time.DateOnly, raw)
	if err != nil {
		return time.Time{}, invalid("Muddat noto'g'ri")
	}
	return day, nil
}

// formatDay writes a day for people to read: 10.10.2026.
func formatDay(day time.Time) string {
	return day.Format("02.01.2006")
}

// head is what every order has beside the answers to its type's fields, as
// the history writes it: the stage and the assignee by their names. The
// number is not here: it never changes.
type head struct {
	Deadline time.Time
	Stage    string
	Assignee string
}

// diffHead tells what an edit changed in an order's own fields, in this order:
// the deadline, the stage, the assignee. Nothing when the edit changed
// none of them.
func diffHead(was, now head) []fields.Change {
	var changes []fields.Change
	if !was.Deadline.Equal(now.Deadline) {
		changes = append(changes, fields.Change{Label: "Muddat", Old: formatDay(was.Deadline), New: formatDay(now.Deadline)})
	}
	if was.Stage != now.Stage {
		changes = append(changes, fields.Change{Label: "Bosqich", Old: was.Stage, New: now.Stage})
	}
	if was.Assignee != now.Assignee {
		changes = append(changes, fields.Change{Label: "Mas'ul", Old: was.Assignee, New: now.Assignee})
	}
	return changes
}

// diffMoney tells what an edit changed in an order's money, after the
// fields: the price and the lines, as the history writes them
// (logic/orders.md, section 7).
func diffMoney(was, now warehouse.OrderMoney) []fields.Change {
	var changes []fields.Change
	if was.PriceText() != now.PriceText() {
		changes = append(changes, fields.Change{Label: "Narx", Old: was.PriceText(), New: now.PriceText()})
	}
	if was.LinesText() != now.LinesText() {
		changes = append(changes, fields.Change{Label: "Mahsulotlar", Old: was.LinesText(), New: now.LinesText()})
	}
	return changes
}
