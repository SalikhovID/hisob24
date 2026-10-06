package app

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/SalikhovID/hisob24/backend/internal/access"
	"github.com/SalikhovID/hisob24/backend/internal/fields"
	"github.com/SalikhovID/hisob24/backend/internal/httpx"
	"github.com/SalikhovID/hisob24/backend/internal/task"
)

type taskCustomerJSON struct {
	ID    int64   `json:"id"`
	Phone string  `json:"phone"`
	Name  *string `json:"name"`
}

type taskAssigneeJSON struct {
	Phone    string  `json:"phone"`
	FullName *string `json:"full_name"`
}

type taskJSON struct {
	ID      int64  `json:"id"`
	TypeID  int64  `json:"type_id"`
	StageID int64  `json:"stage_id"`
	Title   string `json:"title"`
	// Deadline is a day, YYYY-MM-DD.
	Deadline string            `json:"deadline"`
	Customer taskCustomerJSON  `json:"customer"`
	Assignee *taskAssigneeJSON `json:"assignee"`
	// Values are the answers by the id of the field, as a customer's.
	Values        fields.Values `json:"values"`
	CreatedByName *string       `json:"created_by_name"`
	CreatedAt     time.Time     `json:"created_at"`
	UpdatedAt     time.Time     `json:"updated_at"`
}

func toTaskJSON(t task.Task) taskJSON {
	body := taskJSON{
		ID: t.ID, TypeID: t.TypeID, StageID: t.StageID, Title: t.Title, Deadline: t.Deadline.Format(time.DateOnly),
		Customer: taskCustomerJSON{ID: t.Customer.ID, Phone: t.Customer.Phone, Name: t.Customer.Name},
		Values:   t.Values, CreatedByName: t.CreatedByName, CreatedAt: t.CreatedAt, UpdatedAt: t.UpdatedAt,
	}
	if t.Assignee != nil {
		body.Assignee = &taskAssigneeJSON{Phone: t.Assignee.Phone, FullName: t.Assignee.Name}
	}
	return body
}

// taskInputJSON is what a task is saved with, in the body of a new task and
// of an edit.
type taskInputJSON struct {
	Title         string                     `json:"title"`
	Deadline      string                     `json:"deadline"`
	StageID       int64                      `json:"stage_id"`
	AssigneePhone *string                    `json:"assignee_phone"`
	Values        map[string]json.RawMessage `json:"values"`
}

func (in taskInputJSON) input() task.Input {
	return task.Input{Title: in.Title, Deadline: in.Deadline, StageID: in.StageID, AssigneePhone: in.AssigneePhone, Values: in.Values}
}

// taskCustomerInputJSON names a new task's customer: one that is there, by
// its id, or a new one by its type, phone and answers.
type taskCustomerInputJSON struct {
	ID     *int64                     `json:"id"`
	TypeID int64                      `json:"type_id"`
	Phone  string                     `json:"phone"`
	Values map[string]json.RawMessage `json:"values"`
}

// input is the customer as the service takes it: nothing when the body
// named none, which the service refuses.
func (in *taskCustomerInputJSON) input() task.CustomerInput {
	switch {
	case in == nil:
		return task.CustomerInput{}
	case in.ID != nil:
		return task.CustomerInput{ID: in.ID}
	case in.TypeID != 0 || in.Phone != "" || len(in.Values) > 0:
		return task.CustomerInput{New: &task.NewCustomer{TypeID: in.TypeID, Phone: in.Phone, Values: in.Values}}
	}
	return task.CustomerInput{}
}

// createTask enters a task into the company the session works in, as the
// member the session is of; a new customer is entered with it.
func (h *Handler) createTask(w http.ResponseWriter, r *http.Request) {
	var body struct {
		taskInputJSON
		TypeID   int64                  `json:"type_id"`
		Customer *taskCustomerInputJSON `json:"customer"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	customer := body.Customer.input()
	// A customer entered with the task is a customer entered: that takes
	// its own permission (logic/roles.md, section 4.3).
	if customer.New != nil && !currentPermissions(r.Context()).Has(access.CustomersCreate) {
		forbidden(w)
		return
	}
	t, err := h.tasks.Create(r.Context(), sessionCompany(r), currentUser(r.Context()).Phone, body.TypeID, body.input(), customer)
	if err != nil {
		// A new customer's phone or answer may be another customer's.
		writeCustomerError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, toTaskJSON(t))
}

// getTask is a task of the company the session works in.
func (h *Handler) getTask(w http.ResponseWriter, r *http.Request) {
	t, err := h.tasks.Get(r.Context(), sessionCompany(r), pathID(r, "id"))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toTaskJSON(t))
}

type taskPageJSON struct {
	Items    []taskJSON `json:"items"`
	Total    int64      `json:"total"`
	Page     int        `json:"page"`
	PageSize int        `json:"page_size"`
}

// listTasks is a page of the tasks of the company the session works in,
// the one due soonest first: ?search= looks in the titles, the text answers
// and the customers' names (as digits, in the customers' phones and the
// number answers too); ?type_id=, ?stage_id=, ?customer_id= and ?assignee=
// (a phone) each keep one; ?page= starts at 1.
func (h *Handler) listTasks(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	in := task.ListInput{Search: query.Get("search"), Assignee: query.Get("assignee"), Page: 1}
	if p := query.Get("page"); p != "" {
		n, err := strconv.Atoi(p)
		if err != nil {
			httpx.Error(w, http.StatusBadRequest, "validation_error", "Sahifa raqami noto'g'ri")
			return
		}
		in.Page = n
	}
	for _, f := range []struct {
		name, message string
		into          *int64
	}{
		{"type_id", "Vazifa turi noto'g'ri", &in.TypeID},
		{"stage_id", "Bosqich noto'g'ri", &in.StageID},
		{"customer_id", "Mijoz noto'g'ri", &in.CustomerID},
	} {
		raw := query.Get(f.name)
		if raw == "" {
			continue
		}
		id, err := strconv.ParseInt(raw, 10, 64)
		if err != nil || id <= 0 {
			httpx.Error(w, http.StatusBadRequest, "validation_error", f.message)
			return
		}
		*f.into = id
	}
	page, err := h.tasks.List(r.Context(), sessionCompany(r), in)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	items := make([]taskJSON, 0, len(page.Items))
	for _, t := range page.Items {
		items = append(items, toTaskJSON(t))
	}
	httpx.JSON(w, http.StatusOK, taskPageJSON{Items: items, Total: page.Total, Page: page.Page, PageSize: page.PageSize})
}

// updateTask saves a task of the company the session works in with another
// title, deadline, stage, assignee and answers, as the member the session
// is of.
func (h *Handler) updateTask(w http.ResponseWriter, r *http.Request) {
	var body taskInputJSON
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	t, err := h.tasks.Update(r.Context(), sessionCompany(r), pathID(r, "id"), currentUser(r.Context()).Phone, body.input())
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toTaskJSON(t))
}

// moveTask puts a task of the company the session works in into another
// stage, as the member the session is of.
func (h *Handler) moveTask(w http.ResponseWriter, r *http.Request) {
	var body struct {
		StageID int64 `json:"stage_id"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	t, err := h.tasks.Move(r.Context(), sessionCompany(r), pathID(r, "id"), currentUser(r.Context()).Phone, body.StageID)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toTaskJSON(t))
}

// deleteTask hides a task of the company the session works in, as the
// member the session is of.
func (h *Handler) deleteTask(w http.ResponseWriter, r *http.Request) {
	err := h.tasks.Delete(r.Context(), sessionCompany(r), pathID(r, "id"), currentUser(r.Context()).Phone)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// taskHistory is what happened to a task of the owner's company, the
// latest first.
func (h *Handler) taskHistory(w http.ResponseWriter, r *http.Request) {
	history, err := h.tasks.History(r.Context(), sessionCompany(r), pathID(r, "id"))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	body := make([]historyEntryJSON, 0, len(history))
	for _, e := range history {
		changes := make([]changeJSON, 0, len(e.Changes))
		for _, c := range e.Changes {
			changes = append(changes, changeJSON{Label: c.Label, Old: c.Old, New: c.New})
		}
		body = append(body, historyEntryJSON{ID: e.ID, Action: e.Action, ActorName: e.ActorName, CreatedAt: e.CreatedAt, Changes: changes})
	}
	httpx.JSON(w, http.StatusOK, body)
}
