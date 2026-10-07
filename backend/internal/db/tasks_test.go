package db_test

import (
	"fmt"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

// assignedTo is the member the tasks of these tests are assigned to.
const assignedTo = "998902222222"

// day is a date as the queries take it.
func day(s string) time.Time {
	d, err := time.Parse(time.DateOnly, s)
	if err != nil {
		panic(err)
	}
	return d
}

// taskShop is a company set up for tasks: enteredBy (its owner, "Ali
// Valiyev") and assignedTo (a user, "Vali Aliyev"); its location Asosiy; a
// customer type with a name field and the customer Ali; two stages; a task
// type with a text field, a whole number and a choice over Manba.
type taskShop struct {
	company             gen.Company
	asosiy              int64
	jismoniy            gen.CustomerType
	fish                gen.CustomerField
	ali                 gen.Customer
	yangi, bajarildi    gen.TaskStage
	buyurtma            gen.TaskType
	izoh, summa, kanal  gen.TaskField
	manba               gen.CustomerDropdown
	instagram, linkedin gen.CustomerDropdownOption
}

func newTaskShop(t *testing.T, q *gen.Queries, pool *pgxpool.Pool, name string) taskShop {
	t.Helper()
	var s taskShop
	s.company = createCompany(t, q, name, today(t, pool))
	mustExec(t, pool, "INSERT INTO users (phone) VALUES ($1), ($2) ON CONFLICT (phone) DO NOTHING", enteredBy, assignedTo)
	mustExec(t, pool, `INSERT INTO user_companies (user_phone, company_id, role, full_name)
		VALUES ($1, $3, 'owner', 'Ali Valiyev'), ($2, $3, 'user', 'Vali Aliyev')`, enteredBy, assignedTo, s.company.ID)
	s.asosiy = addLocation(t, pool, s.company.ID, "Asosiy")
	s.jismoniy = createType(t, q, s.company.ID, "Jismoniy")
	s.fish = addField(t, q, s.company.ID, s.jismoniy.ID, "F.I.Sh.", "string", nil)
	s.ali = createCustomer(t, q, s.company.ID, s.jismoniy.ID, "998901234567")
	answer(t, q, s.ali.ID, s.fish.ID, "Ali Valiyev")
	s.yangi = createStage(t, q, s.company.ID, "Yangi", "blue")
	s.bajarildi = createStage(t, q, s.company.ID, "Bajarildi", "green")
	s.manba = createDropdown(t, q, s.company.ID, "Manba")
	s.instagram = addOption(t, q, s.company.ID, s.manba.ID, "Instagram")
	s.linkedin = addOption(t, q, s.company.ID, s.manba.ID, "LinkedIn")
	s.buyurtma = createTaskType(t, q, s.company.ID, "Buyurtma")
	s.izoh = addTaskField(t, q, s.company.ID, s.buyurtma.ID, "Izoh", "string", nil)
	s.summa = addTaskField(t, q, s.company.ID, s.buyurtma.ID, "Summa", "int", nil)
	s.kanal = addTaskField(t, q, s.company.ID, s.buyurtma.ID, "Kanal", "checkbox", &s.manba.ID)
	return s
}

// task enters a task of the shop's type for Ali, in the first stage and in
// Asosiy, as enteredBy; assignee is the member it is assigned to, if any.
func (s taskShop) task(t *testing.T, q *gen.Queries, title, deadline string, assignee *string) gen.Task {
	t.Helper()
	var assigneeName *string
	if assignee != nil {
		assigneeName = ptr("Vali Aliyev")
	}
	task, err := q.CreateTask(t.Context(), gen.CreateTaskParams{
		CompanyID: s.company.ID, TypeID: s.buyurtma.ID, StageID: s.yangi.ID, CustomerID: s.ali.ID, LocationID: s.asosiy,
		Title: title, Deadline: day(deadline), AssigneePhone: assignee, AssigneeName: assigneeName,
		CreatedBy: enteredBy, CreatedByName: ptr("Ali Valiyev"),
	})
	require.NoError(t, err)
	return task
}

func TestCreateTask(t *testing.T) {
	q, pool := setup(t)
	s := newTaskShop(t, q, pool, "Olma")

	task, err := q.CreateTask(t.Context(), gen.CreateTaskParams{
		CompanyID: s.company.ID, TypeID: s.buyurtma.ID, StageID: s.yangi.ID, CustomerID: s.ali.ID, LocationID: s.asosiy,
		Title: "Qo'ng'iroq qilish", Deadline: day("2026-10-10"), AssigneePhone: ptr(assignedTo), AssigneeName: ptr("Vali aka"),
		CreatedBy: enteredBy, CreatedByName: ptr("Ali aka"),
	})

	require.NoError(t, err)
	assert.Positive(t, task.ID)
	assert.Equal(t, s.company.ID, task.CompanyID)
	assert.Equal(t, s.buyurtma.ID, task.TypeID)
	assert.Equal(t, s.yangi.ID, task.StageID)
	assert.Equal(t, s.ali.ID, task.CustomerID)
	assert.Equal(t, s.asosiy, task.LocationID, "the location the task stands in")
	assert.Equal(t, "Qo'ng'iroq qilish", task.Title)
	assert.True(t, task.Deadline.Equal(day("2026-10-10")), "deadline %s", task.Deadline)
	assert.Equal(t, ptr(assignedTo), task.AssigneePhone)
	assert.Equal(t, ptr("Vali aka"), task.AssigneeName, "the name the assignee went by then")
	assert.Equal(t, ptr("Ali aka"), task.CreatedByName, "the name the member went by then")
	assert.Equal(t, task.CreatedAt, task.UpdatedAt, "not edited yet")
	assert.Nil(t, task.DeletedAt)
	unassigned := s.task(t, q, "Hisob yozish", "2026-10-11", nil)
	assert.Nil(t, unassigned.AssigneePhone)
	assert.Nil(t, unassigned.AssigneeName)
}

func TestGetTask(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	s := newTaskShop(t, q, pool, "Olma")
	nok := createCompany(t, q, "Nok", today(t, pool))
	task := s.task(t, q, "Qo'ng'iroq", "2026-10-10", ptr(assignedTo))

	got, err := q.GetTask(ctx, gen.GetTaskParams{ID: task.ID, CompanyID: s.company.ID})

	require.NoError(t, err)
	assert.Equal(t, "Qo'ng'iroq", got.Title)
	assert.Equal(t, s.asosiy, got.LocationID, "the location the task stands in")
	assert.Equal(t, "998901234567", got.CustomerPhone)
	assert.Equal(t, ptr("Ali Valiyev"), got.CustomerName, "the customer's answer to its type's first text field")
	assert.Equal(t, ptr("Vali Aliyev"), got.AssigneeName, "the name the assignee goes by in the company now")
	assert.Equal(t, ptr("Ali Valiyev"), got.CreatedByName)

	mustExec(t, pool, "UPDATE user_companies SET full_name = 'Vali (yangi)' WHERE user_phone = $1", assignedTo)
	got, err = q.GetTask(ctx, gen.GetTaskParams{ID: task.ID, CompanyID: s.company.ID})
	require.NoError(t, err)
	assert.Equal(t, ptr("Vali (yangi)"), got.AssigneeName, "the name as it is now")
	mustExec(t, pool, "DELETE FROM user_companies WHERE user_phone = $1", assignedTo)
	got, err = q.GetTask(ctx, gen.GetTaskParams{ID: task.ID, CompanyID: s.company.ID})
	require.NoError(t, err)
	assert.Equal(t, ptr("Vali Aliyev"), got.AssigneeName, "once they have left the company, the name of then")

	nameless := createCustomer(t, q, s.company.ID, s.jismoniy.ID, "998907654321")
	other, err := q.CreateTask(ctx, gen.CreateTaskParams{
		CompanyID: s.company.ID, TypeID: s.buyurtma.ID, StageID: s.yangi.ID, CustomerID: nameless.ID, LocationID: s.asosiy,
		Title: "X", Deadline: day("2026-10-10"), CreatedBy: enteredBy,
	})
	require.NoError(t, err)
	got, err = q.GetTask(ctx, gen.GetTaskParams{ID: other.ID, CompanyID: s.company.ID})
	require.NoError(t, err)
	assert.Nil(t, got.CustomerName, "a customer that goes by no name")

	_, err = q.GetTask(ctx, gen.GetTaskParams{ID: task.ID, CompanyID: nok.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's task")
	mustExec(t, pool, "UPDATE tasks SET deleted_at = now() WHERE id = $1", task.ID)
	_, err = q.GetTask(ctx, gen.GetTaskParams{ID: task.ID, CompanyID: s.company.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "a deleted task")
}

// titles is the titles of the tasks listed, in their order.
func titles(rows []gen.ListTasksRow) []string {
	list := make([]string, 0, len(rows))
	for _, r := range rows {
		list = append(list, r.Title)
	}
	return list
}

// seedTasks enters five tasks into the shop: three due on different days,
// one of them assigned, one of another type for another customer, and one
// deleted. It returns the tasks that stay.
func seedTasks(t *testing.T, q *gen.Queries, pool *pgxpool.Pool, s taskShop) (later, sooner, soonest, other gen.Task) {
	t.Helper()
	later = s.task(t, q, "Hisob yozish", "2026-10-12", nil)
	sooner = s.task(t, q, "Qo'ng'iroq qilish", "2026-10-10", ptr(assignedTo))
	soonest = s.task(t, q, "Shartnoma", "2026-10-09", nil)
	vali := createCustomer(t, q, s.company.ID, s.jismoniy.ID, "998905555555")
	answer(t, q, vali.ID, s.fish.ID, "Zarina Karimova")
	inn := addField(t, q, s.company.ID, s.jismoniy.ID, "INN", "int", nil)
	answerNumber(t, q, vali.ID, inn.ID, 301234567)
	shikoyat := createTaskType(t, q, s.company.ID, "Shikoyat")
	done := createStage(t, q, s.company.ID, "Yopiq", "slate")
	var err error
	other, err = q.CreateTask(t.Context(), gen.CreateTaskParams{
		CompanyID: s.company.ID, TypeID: shikoyat.ID, StageID: done.ID, CustomerID: vali.ID, LocationID: s.asosiy,
		Title: "Shikoyatni ko'rish", Deadline: day("2026-10-10"), CreatedBy: enteredBy,
	})
	require.NoError(t, err)
	gone := s.task(t, q, "O'chirilgan", "2026-10-01", nil)
	mustExec(t, pool, "UPDATE tasks SET deleted_at = now() WHERE id = $1", gone.ID)
	return later, sooner, soonest, other
}

func TestListTasks(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	s := newTaskShop(t, q, pool, "Olma")
	nok := newTaskShop(t, q, pool, "Nok")
	nok.task(t, q, "Begona", "2026-10-01", nil)
	later, sooner, soonest, other := seedTasks(t, q, pool, s)
	require.NoError(t, q.AddTaskValue(ctx, gen.AddTaskValueParams{TaskID: later.ID, FieldID: s.izoh.ID, TextValue: ptr("Ertalab yozish")}))
	require.NoError(t, q.AddTaskValue(ctx, gen.AddTaskValueParams{TaskID: later.ID, FieldID: s.summa.ID, IntValue: ptr(int64(45000))}))
	all := gen.ListTasksParams{CompanyID: s.company.ID, Limit: 20}

	rows, err := q.ListTasks(ctx, all)

	require.NoError(t, err)
	assert.Equal(t, []string{"Shartnoma", "Qo'ng'iroq qilish", "Shikoyatni ko'rish", "Hisob yozish"}, titles(rows),
		"the one due soonest first, the older task before the newer of one day; the deleted one and another company's are out")
	assert.Equal(t, "998901234567", rows[0].CustomerPhone)
	assert.Equal(t, ptr("Ali Valiyev"), rows[0].CustomerName)
	assert.Equal(t, ptr("Vali Aliyev"), rows[1].AssigneeName)
	assert.Nil(t, rows[0].AssigneeName)

	page := all
	page.Limit, page.Offset = 2, 2
	rows, err = q.ListTasks(ctx, page)
	require.NoError(t, err)
	assert.Equal(t, []string{"Shikoyatni ko'rish", "Hisob yozish"}, titles(rows), "the second page of two")

	for about, tc := range map[string]struct {
		params func(p gen.ListTasksParams) gen.ListTasksParams
		want   []string
	}{
		"of one type":                         {func(p gen.ListTasksParams) gen.ListTasksParams { p.TypeID = &other.TypeID; return p }, []string{"Shikoyatni ko'rish"}},
		"in one stage":                        {func(p gen.ListTasksParams) gen.ListTasksParams { p.StageID = &s.yangi.ID; return p }, []string{"Shartnoma", "Qo'ng'iroq qilish", "Hisob yozish"}},
		"of one assignee":                     {func(p gen.ListTasksParams) gen.ListTasksParams { p.AssigneePhone = ptr(assignedTo); return p }, []string{"Qo'ng'iroq qilish"}},
		"of one customer":                     {func(p gen.ListTasksParams) gen.ListTasksParams { p.CustomerID = &other.CustomerID; return p }, []string{"Shikoyatni ko'rish"}},
		"a search in the title":               {func(p gen.ListTasksParams) gen.ListTasksParams { p.Search = ptr("qo'ng"); return p }, []string{"Qo'ng'iroq qilish"}},
		"a search in the task's text answers": {func(p gen.ListTasksParams) gen.ListTasksParams { p.Search = ptr("ertalab"); return p }, []string{"Hisob yozish"}},
		"a search in the customer's name":     {func(p gen.ListTasksParams) gen.ListTasksParams { p.Search = ptr("karim"); return p }, []string{"Shikoyatni ko'rish"}},
		"a number in the customer's phone": {func(p gen.ListTasksParams) gen.ListTasksParams {
			p.Search, p.Digits = ptr("5555"), ptr("5555")
			return p
		}, []string{"Shikoyatni ko'rish"}},
		"a number in the task's answers": {func(p gen.ListTasksParams) gen.ListTasksParams { p.Search, p.Digits = ptr("450"), ptr("450"); return p }, []string{"Hisob yozish"}},
		"a number in the customer's number answers": {func(p gen.ListTasksParams) gen.ListTasksParams {
			p.Search, p.Digits = ptr("3012"), ptr("3012")
			return p
		}, []string{"Shikoyatni ko'rish"}},
		"a search that finds nothing": {func(p gen.ListTasksParams) gen.ListTasksParams { p.Search = ptr("yo'q"); return p }, []string{}},
		"a stage and a search together": {func(p gen.ListTasksParams) gen.ListTasksParams {
			p.StageID, p.Search = &s.yangi.ID, ptr("karim")
			return p
		}, []string{}},
	} {
		rows, err := q.ListTasks(ctx, tc.params(all))
		require.NoError(t, err, about)
		assert.Equal(t, tc.want, titles(rows), about)
		p := tc.params(all)
		count, err := q.CountTasks(ctx, gen.CountTasksParams{
			CompanyID: p.CompanyID, TypeID: p.TypeID, StageID: p.StageID, AssigneePhone: p.AssigneePhone,
			CustomerID: p.CustomerID, Search: p.Search, Digits: p.Digits,
		})
		require.NoError(t, err, about)
		assert.EqualValues(t, len(tc.want), count, "the count of %s", about)
	}
	_ = sooner
	_ = soonest
}

func TestUpdateTask(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	s := newTaskShop(t, q, pool, "Olma")
	nok := createCompany(t, q, "Nok", today(t, pool))
	task := s.task(t, q, "Qo'ng'iroq", "2026-10-10", nil)
	mustExec(t, pool, "UPDATE tasks SET updated_at = created_at - interval '1 hour' WHERE id = $1", task.ID)

	updatedAt, err := q.UpdateTask(ctx, gen.UpdateTaskParams{
		ID: task.ID, CompanyID: s.company.ID, Title: "Qayta qo'ng'iroq", Deadline: day("2026-10-12"), StageID: s.bajarildi.ID,
		AssigneePhone: ptr(assignedTo), AssigneeName: ptr("Vali Aliyev"),
	})

	require.NoError(t, err)
	assert.True(t, updatedAt.After(task.CreatedAt), "the moment of the edit")
	got, err := q.GetTask(ctx, gen.GetTaskParams{ID: task.ID, CompanyID: s.company.ID})
	require.NoError(t, err)
	assert.Equal(t, "Qayta qo'ng'iroq", got.Title)
	assert.True(t, got.Deadline.Equal(day("2026-10-12")))
	assert.Equal(t, s.bajarildi.ID, got.StageID)
	assert.Equal(t, ptr(assignedTo), got.AssigneePhone)
	assert.Equal(t, s.ali.ID, got.CustomerID, "the customer stays")
	assert.Equal(t, s.buyurtma.ID, got.TypeID, "the type stays")

	_, err = q.UpdateTask(ctx, gen.UpdateTaskParams{ID: task.ID, CompanyID: nok.ID, Title: "X", Deadline: day("2026-10-12"), StageID: s.yangi.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's task")
	mustExec(t, pool, "UPDATE tasks SET deleted_at = now() WHERE id = $1", task.ID)
	_, err = q.UpdateTask(ctx, gen.UpdateTaskParams{ID: task.ID, CompanyID: s.company.ID, Title: "X", Deadline: day("2026-10-12"), StageID: s.yangi.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "a deleted task")
}

func TestMoveTask(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	s := newTaskShop(t, q, pool, "Olma")
	nok := createCompany(t, q, "Nok", today(t, pool))
	task := s.task(t, q, "Qo'ng'iroq", "2026-10-10", ptr(assignedTo))
	mustExec(t, pool, "UPDATE tasks SET updated_at = created_at - interval '1 hour' WHERE id = $1", task.ID)

	updatedAt, err := q.MoveTask(ctx, gen.MoveTaskParams{ID: task.ID, CompanyID: s.company.ID, StageID: s.bajarildi.ID})

	require.NoError(t, err)
	assert.True(t, updatedAt.After(task.CreatedAt), "the moment of the move")
	got, err := q.GetTask(ctx, gen.GetTaskParams{ID: task.ID, CompanyID: s.company.ID})
	require.NoError(t, err)
	assert.Equal(t, s.bajarildi.ID, got.StageID)
	assert.Equal(t, "Qo'ng'iroq", got.Title, "nothing else changes")
	assert.Equal(t, ptr(assignedTo), got.AssigneePhone)

	_, err = q.MoveTask(ctx, gen.MoveTaskParams{ID: task.ID, CompanyID: nok.ID, StageID: s.yangi.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's task")
	mustExec(t, pool, "UPDATE tasks SET deleted_at = now() WHERE id = $1", task.ID)
	_, err = q.MoveTask(ctx, gen.MoveTaskParams{ID: task.ID, CompanyID: s.company.ID, StageID: s.yangi.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "a deleted task")
}

func TestDeleteTask(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	s := newTaskShop(t, q, pool, "Olma")
	nok := createCompany(t, q, "Nok", today(t, pool))
	task := s.task(t, q, "Qo'ng'iroq", "2026-10-10", nil)

	_, err := q.DeleteTask(ctx, gen.DeleteTaskParams{ID: task.ID, CompanyID: nok.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's task")
	id, err := q.DeleteTask(ctx, gen.DeleteTaskParams{ID: task.ID, CompanyID: s.company.ID})
	require.NoError(t, err)
	assert.Equal(t, task.ID, id)

	var hidden bool
	require.NoError(t, pool.QueryRow(ctx, "SELECT deleted_at IS NOT NULL FROM tasks WHERE id = $1", task.ID).Scan(&hidden))
	assert.True(t, hidden, "the row stays, marked deleted")
	_, err = q.DeleteTask(ctx, gen.DeleteTaskParams{ID: task.ID, CompanyID: s.company.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "deleted already")
}

// storedTaskValues is the task's answers as they are stored, each row as
// "field: answer" with an option by its name, in the order of the fields.
func storedTaskValues(t *testing.T, pool *pgxpool.Pool, taskID int64) []string {
	t.Helper()
	rows, err := pool.Query(t.Context(), `SELECT f.label || ': ' || COALESCE(v.text_value, v.int_value::text, o.label)
		FROM task_values v
		JOIN task_fields f ON f.id = v.field_id
		LEFT JOIN customer_dropdown_options o ON o.id = v.option_id
		WHERE v.task_id = $1 ORDER BY f.position, o.position`, taskID)
	require.NoError(t, err)
	stored, err := pgx.CollectRows(rows, pgx.RowTo[string])
	require.NoError(t, err)
	return stored
}

func TestTaskValues(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	s := newTaskShop(t, q, pool, "Olma")
	first := s.task(t, q, "Qo'ng'iroq", "2026-10-10", nil)
	second := s.task(t, q, "Hisob", "2026-10-11", nil)
	mustExec(t, pool, "UPDATE task_fields SET position = 0 WHERE id = $1", s.summa.ID)
	mustExec(t, pool, "UPDATE customer_dropdown_options SET position = 0 WHERE id = $1", s.linkedin.ID)

	require.NoError(t, q.AddTaskValue(ctx, gen.AddTaskValueParams{TaskID: first.ID, FieldID: s.izoh.ID, TextValue: ptr("Ertalab")}))
	require.NoError(t, q.AddTaskValue(ctx, gen.AddTaskValueParams{TaskID: first.ID, FieldID: s.summa.ID, IntValue: ptr(int64(45000))}))
	require.NoError(t, q.AddTaskValue(ctx, gen.AddTaskValueParams{TaskID: first.ID, FieldID: s.kanal.ID, OptionID: &s.instagram.ID}))
	require.NoError(t, q.AddTaskValue(ctx, gen.AddTaskValueParams{TaskID: first.ID, FieldID: s.kanal.ID, OptionID: &s.linkedin.ID}))
	require.NoError(t, q.AddTaskValue(ctx, gen.AddTaskValueParams{TaskID: second.ID, FieldID: s.izoh.ID, TextValue: ptr("Kechqurun")}))
	assert.Equal(t, []string{"Summa: 45000", "Izoh: Ertalab", "Kanal: LinkedIn", "Kanal: Instagram"}, storedTaskValues(t, pool, first.ID))

	rows, err := q.ListTaskValues(ctx, []int64{first.ID, second.ID})
	require.NoError(t, err)
	described := make([]string, 0, len(rows))
	for _, r := range rows {
		described = append(described, fmt.Sprintf("%d %s %v %v %v", r.TaskID, r.Kind, r.OptionID != nil, r.TextValue != nil, r.IntValue != nil))
	}
	assert.Equal(t, []string{
		fmt.Sprintf("%d int false false true", first.ID),
		fmt.Sprintf("%d string false true false", first.ID),
		fmt.Sprintf("%d checkbox true false false", first.ID),
		fmt.Sprintf("%d checkbox true false false", first.ID),
		fmt.Sprintf("%d string false true false", second.ID),
	}, described, "each task's answers in the order of its type's fields, with the field's kind")
	assert.Equal(t, []*int64{&s.linkedin.ID, &s.instagram.ID}, []*int64{rows[2].OptionID, rows[3].OptionID}, "the options in the order of their dropdown")

	require.NoError(t, q.DeleteTaskValues(ctx, first.ID))
	assert.Empty(t, storedTaskValues(t, pool, first.ID), "the task's answers are cleared")
	assert.Equal(t, []string{"Izoh: Kechqurun"}, storedTaskValues(t, pool, second.ID), "the other task's stay")
}

func TestCountTasksInUse(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	s := newTaskShop(t, q, pool, "Olma")
	first := s.task(t, q, "Qo'ng'iroq", "2026-10-10", nil)
	second := s.task(t, q, "Hisob", "2026-10-11", nil)
	gone := s.task(t, q, "O'chirilgan", "2026-10-12", nil)
	for _, id := range []int64{first.ID, second.ID, gone.ID} {
		require.NoError(t, q.AddTaskValue(ctx, gen.AddTaskValueParams{TaskID: id, FieldID: s.izoh.ID, TextValue: ptr("Izoh")}))
		require.NoError(t, q.AddTaskValue(ctx, gen.AddTaskValueParams{TaskID: id, FieldID: s.kanal.ID, OptionID: &s.instagram.ID}))
	}
	mustExec(t, pool, "UPDATE tasks SET deleted_at = now() WHERE id = $1", gone.ID)

	stage, err := q.CountStageTasks(ctx, s.yangi.ID)
	require.NoError(t, err)
	assert.EqualValues(t, 2, stage, "the tasks in the stage, without the deleted one")
	none, err := q.CountStageTasks(ctx, s.bajarildi.ID)
	require.NoError(t, err)
	assert.Zero(t, none)
	typ, err := q.CountTypeTasks(ctx, s.buyurtma.ID)
	require.NoError(t, err)
	assert.EqualValues(t, 2, typ, "the tasks of the type")
	field, err := q.CountTaskFieldTasks(ctx, s.izoh.ID)
	require.NoError(t, err)
	assert.EqualValues(t, 2, field, "the tasks that filled the field in")
	option, err := q.CountOptionTasks(ctx, &s.instagram.ID)
	require.NoError(t, err)
	assert.EqualValues(t, 2, option, "the tasks that chose the option")
	unchosen, err := q.CountOptionTasks(ctx, &s.linkedin.ID)
	require.NoError(t, err)
	assert.Zero(t, unchosen)
	customer, err := q.CountCustomerTasks(ctx, s.ali.ID)
	require.NoError(t, err)
	assert.EqualValues(t, 2, customer, "the customer's tasks, without the deleted one")
}

func TestTaskHistoryQueries(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	s := newTaskShop(t, q, pool, "Olma")
	task := s.task(t, q, "Qo'ng'iroq", "2026-10-10", nil)
	other := s.task(t, q, "Hisob", "2026-10-11", nil)

	require.NoError(t, q.AddTaskHistory(ctx, gen.AddTaskHistoryParams{TaskID: task.ID, Action: "created", ActorPhone: enteredBy, ActorName: ptr("Ali aka"), Changes: []byte("[]")}))
	require.NoError(t, q.AddTaskHistory(ctx, gen.AddTaskHistoryParams{
		TaskID: task.ID, Action: "updated", ActorPhone: assignedTo, ActorName: ptr("Vali aka"),
		Changes: []byte(`[{"label":"Bosqich","old":"Yangi","new":"Bajarildi"}]`),
	}))
	require.NoError(t, q.AddTaskHistory(ctx, gen.AddTaskHistoryParams{TaskID: other.ID, Action: "created", ActorPhone: enteredBy, Changes: []byte("[]")}))

	rows, err := q.ListTaskHistory(ctx, task.ID)
	require.NoError(t, err)
	require.Len(t, rows, 2, "the task's own entries")
	assert.Equal(t, "updated", rows[0].Action, "the latest first")
	assert.Equal(t, ptr("Vali Aliyev"), rows[0].ActorName, "the name the member goes by in the company now")
	assert.JSONEq(t, `[{"label":"Bosqich","old":"Yangi","new":"Bajarildi"}]`, string(rows[0].Changes))
	assert.Equal(t, "created", rows[1].Action)
	assert.Equal(t, ptr("Ali Valiyev"), rows[1].ActorName)

	mustExec(t, pool, "DELETE FROM user_companies WHERE user_phone = $1", assignedTo)
	rows, err = q.ListTaskHistory(ctx, task.ID)
	require.NoError(t, err)
	assert.Equal(t, ptr("Vali aka"), rows[0].ActorName, "once they have left the company, the name of then")
}
