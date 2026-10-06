package task

import (
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/fields"
)

func TestTaskTitle(t *testing.T) {
	title, err := taskTitle("  Qo'ng'iroq qilish ")
	require.NoError(t, err)
	assert.Equal(t, "Qo'ng'iroq qilish", title, "without the spaces around it")

	long := strings.Repeat("ў", 200)
	title, err = taskTitle(long)
	require.NoError(t, err, "200 characters are allowed, counted as characters")
	assert.Equal(t, long, title)
	for _, raw := range []string{"", "   "} {
		_, err = taskTitle(raw)
		refused(t, err, apperr.Invalid, "validation_error", "Vazifa nomini kiriting", "%q", raw)
	}
	_, err = taskTitle(long + "a")
	refused(t, err, apperr.Invalid, "validation_error", "Vazifa nomi 200 belgidan oshmasin")
}

func TestTaskDeadline(t *testing.T) {
	day, err := taskDeadline("2026-10-10")
	require.NoError(t, err)
	assert.Equal(t, time.Date(2026, 10, 10, 0, 0, 0, 0, time.UTC), day)

	_, err = taskDeadline("")
	refused(t, err, apperr.Invalid, "validation_error", "Muddatni kiriting")
	_, err = taskDeadline("   ")
	refused(t, err, apperr.Invalid, "validation_error", "Muddatni kiriting", "spaces alone")
	for _, raw := range []string{"10.10.2026", "2026-13-01", "2026-02-30", "2026-1-5", "2026-10-10T00:00:00Z", "bugun"} {
		_, err = taskDeadline(raw)
		refused(t, err, apperr.Invalid, "validation_error", "Muddat noto'g'ri", "%q", raw)
	}
}

func TestDiffHead(t *testing.T) {
	was := head{Title: "Qo'ng'iroq", Deadline: time.Date(2026, 10, 10, 0, 0, 0, 0, time.UTC), Stage: "Yangi", Assignee: ""}
	for _, tt := range []struct {
		name string
		now  head
		want []fields.Change
	}{
		{name: "nothing", now: was, want: nil},
		{name: "the title", now: head{Title: "Qayta qo'ng'iroq", Deadline: was.Deadline, Stage: "Yangi"},
			want: []fields.Change{{Label: "Nomi", Old: "Qo'ng'iroq", New: "Qayta qo'ng'iroq"}}},
		{name: "the deadline, as people write it", now: head{Title: "Qo'ng'iroq", Deadline: time.Date(2026, 10, 12, 0, 0, 0, 0, time.UTC), Stage: "Yangi"},
			want: []fields.Change{{Label: "Muddat", Old: "10.10.2026", New: "12.10.2026"}}},
		{name: "the stage", now: head{Title: "Qo'ng'iroq", Deadline: was.Deadline, Stage: "Bajarildi"},
			want: []fields.Change{{Label: "Bosqich", Old: "Yangi", New: "Bajarildi"}}},
		{name: "an assignee where there was none", now: head{Title: "Qo'ng'iroq", Deadline: was.Deadline, Stage: "Yangi", Assignee: "Vali Aliyev"},
			want: []fields.Change{{Label: "Mas'ul", Old: "", New: "Vali Aliyev"}}},
		{name: "everything, in this order", now: head{Title: "Hisob", Deadline: time.Date(2026, 11, 1, 0, 0, 0, 0, time.UTC), Stage: "Bajarildi", Assignee: "Vali Aliyev"},
			want: []fields.Change{
				{Label: "Nomi", Old: "Qo'ng'iroq", New: "Hisob"},
				{Label: "Muddat", Old: "10.10.2026", New: "01.11.2026"},
				{Label: "Bosqich", Old: "Yangi", New: "Bajarildi"},
				{Label: "Mas'ul", Old: "", New: "Vali Aliyev"},
			}},
	} {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, diffHead(was, tt.now))
		})
	}
	assigned := head{Title: "Qo'ng'iroq", Deadline: was.Deadline, Stage: "Yangi", Assignee: "Vali Aliyev"}
	assert.Equal(t, []fields.Change{{Label: "Mas'ul", Old: "Vali Aliyev", New: ""}}, diffHead(assigned, was), "an assignee taken away")
}
