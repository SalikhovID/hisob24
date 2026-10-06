package task

import (
	"strings"
	"time"
	"unicode/utf8"

	"github.com/SalikhovID/hisob24/backend/internal/fields"
)

// maxTitle is how long a task's title may be, in characters.
const maxTitle = 200

// taskTitle is a task's title as it is kept: without the spaces around it,
// not empty and not longer than maxTitle.
func taskTitle(raw string) (string, error) {
	title := strings.TrimSpace(raw)
	switch {
	case title == "":
		return "", invalid("Vazifa nomini kiriting")
	case utf8.RuneCountInString(title) > maxTitle:
		return "", invalid("Vazifa nomi 200 belgidan oshmasin")
	}
	return title, nil
}

// taskDeadline is a task's deadline as a client sends it: a day written as
// YYYY-MM-DD. A day that is past is taken too: a task may be late already.
func taskDeadline(raw string) (time.Time, error) {
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

// head is what every task has beside the answers to its type's fields, as
// the history writes it: the stage and the assignee by their names.
type head struct {
	Title    string
	Deadline time.Time
	Stage    string
	Assignee string
}

// diffHead tells what an edit changed in a task's own fields, in this order:
// the title, the deadline, the stage, the assignee. Nothing when the edit
// changed none of them.
func diffHead(was, now head) []fields.Change {
	var changes []fields.Change
	if was.Title != now.Title {
		changes = append(changes, fields.Change{Label: "Nomi", Old: was.Title, New: now.Title})
	}
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
