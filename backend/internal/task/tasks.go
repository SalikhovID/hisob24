package task

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/customer"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/fields"
	"github.com/SalikhovID/hisob24/backend/internal/user"
)

var (
	errTaskNotFound = apperr.New(apperr.NotFound, "not_found", "Vazifa topilmadi")
	errNoType       = invalid("Vazifa turini tanlang")
	errNoStage      = invalid("Bosqichni tanlang")
	errNoLocation   = invalid("Lokatsiyani tanlang")
	errNoCustomer   = invalid("Mijozni tanlang")
	errNotMember    = invalid("Mas'ul kompaniya a'zosi emas")
)

// Customer is the customer a task is of, as the task shows it: its phone
// and the name it goes by (its answer to its type's first text field), nil
// when it has none.
type Customer struct {
	ID    int64
	Phone string
	Name  *string
}

// Member is a member of the company a task is assigned to: the phone and
// the name they go by in the company now; once they have left it, the name
// of then.
type Member struct {
	Phone string
	Name  *string
}

// Task is a task of a company: what every task has, its customer, its
// assignee if any, and its answers to the fields of its type.
type Task struct {
	ID      int64
	TypeID  int64
	StageID int64
	// LocationID is the location the task stands in (logic/locations.md):
	// the one it was entered in, for good.
	LocationID int64
	Title      string
	Deadline   time.Time
	Customer   Customer
	Assignee   *Member
	Values     fields.Values
	// CreatedByName is the name the member who entered the task goes by in
	// the company; nil when they go by none.
	CreatedByName *string
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

// Input is what a task is saved with, as the client sent it: the title, the
// deadline as YYYY-MM-DD, the stage, the assignee's phone if any, and the
// answers by the id of the field.
type Input struct {
	Title         string
	Deadline      string
	StageID       int64
	AssigneePhone *string
	Values        map[string]json.RawMessage
}

// NewCustomer is a customer entered together with a task: its type, its
// phone and its answers.
type NewCustomer struct {
	TypeID int64
	Phone  string
	Values map[string]json.RawMessage
}

// CustomerInput names a task's customer: one that is there (ID), or one to
// enter with the task (New).
type CustomerInput struct {
	ID  *int64
	New *NewCustomer
}

// Create enters a task of the company's type for a customer, in a location
// of the company, with the answers to the type's fields; a new customer is
// entered with it, in the same transaction. by is the phone of the member
// who enters it. What is wrong is told in this order: the title, the
// deadline, the location, the type, the stage, the assignee, the answers,
// the customer.
func (s *Service) Create(ctx context.Context, companyID int64, by string, typeID, locationID int64, in Input, cust CustomerInput) (Task, error) {
	title, err := taskTitle(in.Title)
	if err != nil {
		return Task{}, err
	}
	deadline, err := taskDeadline(in.Deadline)
	if err != nil {
		return Task{}, err
	}
	var t Task
	err = s.write(ctx, companyID, func(q *gen.Queries) error {
		if err := locationOf(ctx, q, companyID, locationID); err != nil {
			return err
		}
		_, err := q.GetTaskType(ctx, gen.GetTaskTypeParams{ID: typeID, CompanyID: companyID})
		if errors.Is(err, pgx.ErrNoRows) {
			return errNoType
		}
		if err != nil {
			return err
		}
		if _, err := stageOf(ctx, q, companyID, in.StageID); err != nil {
			return err
		}
		who, err := assigneeOf(ctx, q, companyID, in.AssigneePhone)
		if err != nil {
			return err
		}
		form, options, err := formOf(ctx, q, companyID, typeID)
		if err != nil {
			return err
		}
		values, err := fields.CheckValues(form, options, nil, in.Values)
		if err != nil {
			return err
		}
		customerID, err := s.customerOf(ctx, q, companyID, by, cust)
		if err != nil {
			return err
		}
		name, err := memberName(ctx, q, companyID, by)
		if err != nil {
			return err
		}
		row, err := q.CreateTask(ctx, gen.CreateTaskParams{
			CompanyID: companyID, TypeID: typeID, StageID: in.StageID, CustomerID: customerID, LocationID: locationID, Title: title, Deadline: deadline,
			AssigneePhone: who.phone, AssigneeName: who.name, CreatedBy: by, CreatedByName: name,
		})
		if err != nil {
			return err
		}
		if err := store(ctx, q, row.ID, form, values); err != nil {
			return err
		}
		err = q.AddTaskHistory(ctx, gen.AddTaskHistoryParams{
			TaskID: row.ID, Action: "created", ActorPhone: by, ActorName: name, Changes: []byte("[]"),
		})
		if err != nil {
			return err
		}
		t, err = taskOf(ctx, q, companyID, row.ID)
		return err
	})
	if err != nil {
		return Task{}, err
	}
	return t, nil
}

// assignee is who a task is assigned to, as it is kept: the phone and the
// name they go by now; none when the task is assigned to nobody.
type assignee struct {
	phone, name *string
}

// assigneeOf reads the phone a client sent as the assignee: nil or empty for
// nobody, otherwise a member of the company.
func assigneeOf(ctx context.Context, q *gen.Queries, companyID int64, raw *string) (assignee, error) {
	if raw == nil || strings.TrimSpace(*raw) == "" {
		return assignee{}, nil
	}
	phone, err := user.NormalizePhone(*raw)
	if err != nil {
		return assignee{}, errNotMember
	}
	name, err := q.GetMemberName(ctx, gen.GetMemberNameParams{UserPhone: phone, CompanyID: companyID})
	if errors.Is(err, pgx.ErrNoRows) {
		return assignee{}, errNotMember
	}
	if err != nil {
		return assignee{}, err
	}
	return assignee{phone: &phone, name: name}, nil
}

// sameAssignee tells whether the phone a client sent names the member the
// task is assigned to already (or nobody, when it is assigned to nobody).
func sameAssignee(raw *string, was *Member) bool {
	if raw == nil || strings.TrimSpace(*raw) == "" {
		return was == nil
	}
	phone, err := user.NormalizePhone(*raw)
	return err == nil && was != nil && was.Phone == phone
}

// nameOf is a name as the history writes it: "" for none.
func nameOf(name *string) string {
	if name == nil {
		return ""
	}
	return *name
}

// locationOf checks that the location is the company's own and not deleted:
// a task stands in such a one.
func locationOf(ctx context.Context, q *gen.Queries, companyID, id int64) error {
	_, err := q.GetLocation(ctx, gen.GetLocationParams{ID: id, CompanyID: companyID})
	if errors.Is(err, pgx.ErrNoRows) {
		return errNoLocation
	}
	return err
}

// stageOf is the company's stage, or the refusal to take one that is not.
func stageOf(ctx context.Context, q *gen.Queries, companyID, id int64) (gen.TaskStage, error) {
	st, err := q.GetTaskStage(ctx, gen.GetTaskStageParams{ID: id, CompanyID: companyID})
	if errors.Is(err, pgx.ErrNoRows) {
		return gen.TaskStage{}, errNoStage
	}
	return st, err
}

// stageName is the name of the stage a task stands in, "" once the stage is
// gone.
func stageName(ctx context.Context, q *gen.Queries, companyID, id int64) (string, error) {
	st, err := q.GetTaskStage(ctx, gen.GetTaskStageParams{ID: id, CompanyID: companyID})
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	return st.Name, err
}

// customerOf is the task's customer: the one named, which has to be the
// company's own and not deleted, or the new one entered with the task.
func (s *Service) customerOf(ctx context.Context, q *gen.Queries, companyID int64, by string, cust CustomerInput) (int64, error) {
	switch {
	case cust.ID != nil:
		_, err := q.GetCustomer(ctx, gen.GetCustomerParams{ID: *cust.ID, CompanyID: companyID})
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, errNoCustomer
		}
		return *cust.ID, err
	case cust.New != nil:
		c, err := s.customers.CreateIn(ctx, q, companyID, by, cust.New.TypeID, customer.Input{Phone: cust.New.Phone, Values: cust.New.Values})
		if err != nil {
			return 0, err
		}
		return c.ID, nil
	}
	return 0, errNoCustomer
}

// memberName is the name the user goes by in the company now: what is kept
// beside what they do to its tasks. None for a member without a name, and
// for a user the company has let go meanwhile.
func memberName(ctx context.Context, q *gen.Queries, companyID int64, phone string) (*string, error) {
	name, err := q.GetMemberName(ctx, gen.GetMemberNameParams{UserPhone: phone, CompanyID: companyID})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return name, err
}

// formOf is what the form of a type asks and offers: the type's fields in
// their order, and the options of the company's dropdowns, each dropdown's
// in its order.
func formOf(ctx context.Context, q *gen.Queries, companyID, typeID int64) ([]Field, map[int64][]fields.Option, error) {
	all, err := q.ListTaskFields(ctx, companyID)
	if err != nil {
		return nil, nil, err
	}
	var form []Field
	for _, f := range all {
		if f.TypeID == typeID {
			form = append(form, toField(f))
		}
	}
	rows, err := q.ListCustomerDropdownOptions(ctx, companyID)
	if err != nil {
		return nil, nil, err
	}
	options := map[int64][]fields.Option{}
	for _, o := range rows {
		options[o.DropdownID] = append(options[o.DropdownID], fields.Option{ID: o.ID, Label: o.Label, Active: o.IsActive})
	}
	return form, options, nil
}

// store writes a task's answers to the fields.
func store(ctx context.Context, q *gen.Queries, taskID int64, form []Field, values fields.Values) error {
	for _, f := range form {
		for _, row := range valueRows(f, values[f.ID]) {
			row.TaskID = taskID
			if err := q.AddTaskValue(ctx, row); err != nil {
				return err
			}
		}
	}
	return nil
}

// valueRows is an answer as it is stored: a row for a text or a number, a
// row for each option chosen, none for no answer.
func valueRows(f Field, answer any) []gen.AddTaskValueParams {
	switch a := answer.(type) {
	case string:
		return []gen.AddTaskValueParams{{FieldID: f.ID, TextValue: &a}}
	case int64:
		if choice, _ := fields.KindOf(f.Kind); choice {
			return []gen.AddTaskValueParams{{FieldID: f.ID, OptionID: &a}}
		}
		return []gen.AddTaskValueParams{{FieldID: f.ID, IntValue: &a}}
	case []int64:
		rows := make([]gen.AddTaskValueParams, 0, len(a))
		for _, id := range a {
			rows = append(rows, gen.AddTaskValueParams{FieldID: f.ID, OptionID: &id})
		}
		return rows
	}
	return nil
}

// answersOf reads the answers of the tasks named; a task with none gets an
// empty set.
func answersOf(ctx context.Context, q *gen.Queries, ids []int64) (map[int64]fields.Values, error) {
	rows, err := q.ListTaskValues(ctx, ids)
	if err != nil {
		return nil, err
	}
	of := make(map[int64]fields.Values, len(ids))
	for _, id := range ids {
		of[id] = fields.Values{}
	}
	for _, r := range rows {
		values := of[r.TaskID]
		switch {
		case r.TextValue != nil:
			values[r.FieldID] = *r.TextValue
		case r.IntValue != nil:
			values[r.FieldID] = *r.IntValue
		case r.Kind == fields.KindDropdown || r.Kind == fields.KindRadio:
			values[r.FieldID] = *r.OptionID
		default:
			chosen, _ := values[r.FieldID].([]int64)
			values[r.FieldID] = append(chosen, *r.OptionID)
		}
	}
	return of, nil
}

// taskOf reads the company's task with its answers.
func taskOf(ctx context.Context, q *gen.Queries, companyID, id int64) (Task, error) {
	row, err := q.GetTask(ctx, gen.GetTaskParams{ID: id, CompanyID: companyID})
	if errors.Is(err, pgx.ErrNoRows) {
		return Task{}, errTaskNotFound
	}
	if err != nil {
		return Task{}, err
	}
	answers, err := answersOf(ctx, q, []int64{id})
	if err != nil {
		return Task{}, err
	}
	return toTask(row, answers[id]), nil
}

// toTask is a task as the queries read it, with its answers.
func toTask(row gen.GetTaskRow, values fields.Values) Task {
	t := Task{
		ID: row.ID, TypeID: row.TypeID, StageID: row.StageID, LocationID: row.LocationID, Title: row.Title, Deadline: row.Deadline,
		Customer:      Customer{ID: row.CustomerID, Phone: row.CustomerPhone, Name: row.CustomerName},
		Values:        values,
		CreatedByName: row.CreatedByName, CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt,
	}
	if row.AssigneePhone != nil {
		t.Assignee = &Member{Phone: *row.AssigneePhone, Name: row.AssigneeName}
	}
	return t
}

// Get is the company's task with its answers.
func (s *Service) Get(ctx context.Context, companyID, id int64) (Task, error) {
	return taskOf(ctx, s.q, companyID, id)
}

// PageSize is how many tasks a page of the list holds.
const PageSize = 20

// maxPage keeps the offset inside int32.
const maxPage = 1_000_000

// ListInput narrows the list of tasks: Search is looked for in the titles,
// in the text answers of the tasks and of their customers, and (as a number)
// in the customers' phones and the whole number answers; TypeID, StageID,
// CustomerID and Assignee (a phone) each keep one, 0 or "" leaves the
// filter out. Page starts at 1.
type ListInput struct {
	Search     string
	TypeID     int64
	StageID    int64
	CustomerID int64
	Assignee   string
	Page       int
}

// Page is one page of tasks and how many there are on all of them.
type Page struct {
	Items    []Task
	Total    int64
	Page     int
	PageSize int
}

// List is a page of the company's tasks, the one due soonest first.
func (s *Service) List(ctx context.Context, companyID int64, in ListInput) (Page, error) {
	if in.Page < 1 || in.Page > maxPage {
		return Page{}, invalid("Sahifa raqami noto'g'ri")
	}
	only := func(id int64) *int64 {
		if id == 0 {
			return nil
		}
		return &id
	}
	var assignee *string
	if in.Assignee != "" {
		phone, err := user.NormalizePhone(in.Assignee)
		if err != nil {
			return Page{}, invalid("Mas'ul noto'g'ri")
		}
		assignee = &phone
	}
	search, digits := customer.SearchOf(in.Search)
	total, err := s.q.CountTasks(ctx, gen.CountTasksParams{
		CompanyID: companyID, TypeID: only(in.TypeID), StageID: only(in.StageID), AssigneePhone: assignee, CustomerID: only(in.CustomerID),
		Search: search, Digits: digits,
	})
	if err != nil {
		return Page{}, err
	}
	rows, err := s.q.ListTasks(ctx, gen.ListTasksParams{
		CompanyID: companyID, TypeID: only(in.TypeID), StageID: only(in.StageID), AssigneePhone: assignee, CustomerID: only(in.CustomerID),
		Search: search, Digits: digits, Limit: PageSize, Offset: int32((in.Page - 1) * PageSize),
	})
	if err != nil {
		return Page{}, err
	}
	ids := make([]int64, 0, len(rows))
	for _, row := range rows {
		ids = append(ids, row.ID)
	}
	answers, err := answersOf(ctx, s.q, ids)
	if err != nil {
		return Page{}, err
	}
	items := make([]Task, 0, len(rows))
	for _, row := range rows {
		items = append(items, toTask(gen.GetTaskRow(row), answers[row.ID]))
	}
	return Page{Items: items, Total: total, Page: in.Page, PageSize: PageSize}, nil
}

// Update saves the company's task with another title, deadline, stage,
// assignee and answers; its type and customer stay. The assignee it has
// stays as they are, a member no more too; another one has to be a member.
// by is the phone of the member who edits it.
func (s *Service) Update(ctx context.Context, companyID, id int64, by string, in Input) (Task, error) {
	var t Task
	err := s.write(ctx, companyID, func(q *gen.Queries) error {
		was, err := taskOf(ctx, q, companyID, id)
		if err != nil {
			return err
		}
		title, err := taskTitle(in.Title)
		if err != nil {
			return err
		}
		deadline, err := taskDeadline(in.Deadline)
		if err != nil {
			return err
		}
		stage, err := stageOf(ctx, q, companyID, in.StageID)
		if err != nil {
			return err
		}
		var who assignee
		if sameAssignee(in.AssigneePhone, was.Assignee) {
			if was.Assignee != nil {
				who = assignee{phone: &was.Assignee.Phone, name: was.Assignee.Name}
			}
		} else if who, err = assigneeOf(ctx, q, companyID, in.AssigneePhone); err != nil {
			return err
		}
		form, options, err := formOf(ctx, q, companyID, was.TypeID)
		if err != nil {
			return err
		}
		values, err := fields.CheckValues(form, options, was.Values, in.Values)
		if err != nil {
			return err
		}
		wasStage, err := stageName(ctx, q, companyID, was.StageID)
		if err != nil {
			return err
		}
		var wasAssignee string
		if was.Assignee != nil {
			wasAssignee = nameOf(was.Assignee.Name)
		}
		changed := diffHead(
			head{Title: was.Title, Deadline: was.Deadline, Stage: wasStage, Assignee: wasAssignee},
			head{Title: title, Deadline: deadline, Stage: stage.Name, Assignee: nameOf(who.name)},
		)
		changed = append(changed, fields.DiffValues(form, options, was.Values, values)...)
		if len(changed) == 0 {
			// Nothing to save, and nothing for the history.
			t = was
			return nil
		}
		_, err = q.UpdateTask(ctx, gen.UpdateTaskParams{
			ID: id, CompanyID: companyID, Title: title, Deadline: deadline, StageID: stage.ID,
			AssigneePhone: who.phone, AssigneeName: who.name,
		})
		if err != nil {
			return err
		}
		if err := q.DeleteTaskValues(ctx, id); err != nil {
			return err
		}
		if err := store(ctx, q, id, form, values); err != nil {
			return err
		}
		if err := s.record(ctx, q, companyID, id, "updated", by, changed); err != nil {
			return err
		}
		t, err = taskOf(ctx, q, companyID, id)
		return err
	})
	if err != nil {
		return Task{}, err
	}
	return t, nil
}

// record writes down what a member did to a task.
func (s *Service) record(ctx context.Context, q *gen.Queries, companyID, taskID int64, action, by string, changed []fields.Change) error {
	if changed == nil {
		changed = []fields.Change{}
	}
	changes, err := json.Marshal(changed)
	if err != nil {
		return err
	}
	name, err := memberName(ctx, q, companyID, by)
	if err != nil {
		return err
	}
	return q.AddTaskHistory(ctx, gen.AddTaskHistoryParams{
		TaskID: taskID, Action: action, ActorPhone: by, ActorName: name, Changes: changes,
	})
}

// Move puts the company's task in another stage; the same stage changes
// nothing. by is the phone of the member who moves it.
func (s *Service) Move(ctx context.Context, companyID, id int64, by string, stageID int64) (Task, error) {
	var t Task
	err := s.write(ctx, companyID, func(q *gen.Queries) error {
		was, err := taskOf(ctx, q, companyID, id)
		if err != nil {
			return err
		}
		if was.StageID == stageID {
			t = was
			return nil
		}
		stage, err := stageOf(ctx, q, companyID, stageID)
		if err != nil {
			return err
		}
		wasStage, err := stageName(ctx, q, companyID, was.StageID)
		if err != nil {
			return err
		}
		if _, err := q.MoveTask(ctx, gen.MoveTaskParams{ID: id, CompanyID: companyID, StageID: stageID}); err != nil {
			return err
		}
		changed := []fields.Change{{Label: "Bosqich", Old: wasStage, New: stage.Name}}
		if err := s.record(ctx, q, companyID, id, "updated", by, changed); err != nil {
			return err
		}
		t, err = taskOf(ctx, q, companyID, id)
		return err
	})
	if err != nil {
		return Task{}, err
	}
	return t, nil
}

// Delete hides the company's task: it is gone from the app, and nothing is
// removed. by is the phone of the member who deletes it.
func (s *Service) Delete(ctx context.Context, companyID, id int64, by string) error {
	return s.write(ctx, companyID, func(q *gen.Queries) error {
		_, err := q.DeleteTask(ctx, gen.DeleteTaskParams{ID: id, CompanyID: companyID})
		if errors.Is(err, pgx.ErrNoRows) {
			return errTaskNotFound
		}
		if err != nil {
			return err
		}
		return s.record(ctx, q, companyID, id, "deleted", by, nil)
	})
}

// HistoryEntry is one thing that happened to a task: it was created, updated
// (moved too) or deleted, by whom and when. Changes is what an edit changed.
type HistoryEntry struct {
	ID     int64
	Action string
	// ActorName is the name the member who did it goes by in the company;
	// nil when they go by none.
	ActorName *string
	CreatedAt time.Time
	Changes   []fields.Change
}

// History is what happened to the company's task, the latest first.
func (s *Service) History(ctx context.Context, companyID, id int64) ([]HistoryEntry, error) {
	_, err := s.q.GetTask(ctx, gen.GetTaskParams{ID: id, CompanyID: companyID})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, errTaskNotFound
	}
	if err != nil {
		return nil, err
	}
	rows, err := s.q.ListTaskHistory(ctx, id)
	if err != nil {
		return nil, err
	}
	history := make([]HistoryEntry, 0, len(rows))
	for _, row := range rows {
		e := HistoryEntry{ID: row.ID, Action: row.Action, ActorName: row.ActorName, CreatedAt: row.CreatedAt, Changes: []fields.Change{}}
		if err := json.Unmarshal(row.Changes, &e.Changes); err != nil {
			return nil, err
		}
		history = append(history, e)
	}
	return history, nil
}
