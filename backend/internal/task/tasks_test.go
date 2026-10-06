package task

import (
	"encoding/json"
	"fmt"
	"strconv"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/customer"
	"github.com/SalikhovID/hisob24/backend/internal/fields"
	"github.com/SalikhovID/hisob24/backend/internal/testutil/pgtest"
)

// The members of a shop, by their phones; outsider is a user of no company.
const (
	owner    = "998901111111" // Egamberdi Egasi
	staff    = "998902222222" // Xurshid Xodim
	outsider = "998903333333"
)

// shop is a company set up for tasks: its owner and a user of it; a customer
// type Jismoniy with a name field and the customer Ali; three stages; a task
// type Buyurtma with a required text, a whole number and a choice over
// Manba (YouTube is turned off).
type shop struct {
	id        int64
	customers *customer.Service

	jismoniy   customer.Type
	fish, yosh customer.Field
	ali        customer.Customer

	instagram, linkedin, youtube customer.Option
	manba                        customer.Dropdown

	yangi, jarayonda, bajarildi Stage
	buyurtma                    Type
	izoh, summa, kanal          Field
}

// addMember makes the phone a user, and a member of the company under the
// name and the role given.
func addMember(t *testing.T, pool *pgxpool.Pool, companyID int64, phone, name, role string) {
	t.Helper()
	_, err := pool.Exec(t.Context(), "INSERT INTO users (phone) VALUES ($1) ON CONFLICT DO NOTHING", phone)
	require.NoError(t, err)
	_, err = pool.Exec(t.Context(),
		"INSERT INTO user_companies (user_phone, company_id, role, full_name) VALUES ($1, $2, $3, $4)", phone, companyID, role, name)
	require.NoError(t, err)
}

func newShop(t *testing.T, s *Service, pool *pgxpool.Pool, name string) shop {
	t.Helper()
	ctx := t.Context()
	sh := shop{id: addCompany(t, pool, name), customers: s.customers}
	addMember(t, pool, sh.id, owner, "Egamberdi Egasi", "owner")
	addMember(t, pool, sh.id, staff, "Xurshid Xodim", "user")
	_, err := pool.Exec(ctx, "INSERT INTO users (phone) VALUES ($1) ON CONFLICT DO NOTHING", outsider)
	require.NoError(t, err)

	sh.manba, err = sh.customers.CreateDropdown(ctx, sh.id, "Manba")
	require.NoError(t, err)
	for _, o := range []struct {
		label string
		into  *customer.Option
	}{{"Instagram", &sh.instagram}, {"LinkedIn", &sh.linkedin}, {"YouTube", &sh.youtube}} {
		*o.into, err = sh.customers.AddOption(ctx, sh.id, sh.manba.ID, o.label)
		require.NoError(t, err)
	}
	_, err = sh.customers.UpdateOption(ctx, sh.id, sh.manba.ID, sh.youtube.ID, customer.OptionPatch{Active: ptr(false)})
	require.NoError(t, err)
	sh.jismoniy, err = sh.customers.CreateType(ctx, sh.id, "Jismoniy")
	require.NoError(t, err)
	sh.fish, err = sh.customers.AddField(ctx, sh.id, sh.jismoniy.ID, customer.FieldInput{Label: "F.I.Sh.", Kind: "string", Required: true})
	require.NoError(t, err)
	sh.yosh, err = sh.customers.AddField(ctx, sh.id, sh.jismoniy.ID, customer.FieldInput{Label: "Yoshi", Kind: "int"})
	require.NoError(t, err)
	sh.ali, err = sh.customers.Create(ctx, sh.id, owner, sh.jismoniy.ID, customer.Input{
		Phone: "998901234567", Values: answers(t, map[int64]any{sh.fish.ID: "Ali Valiyev"}),
	})
	require.NoError(t, err)

	sh.yangi = mustStage(t, s, sh.id, "Yangi", "blue")
	sh.jarayonda = mustStage(t, s, sh.id, "Jarayonda", "amber")
	sh.bajarildi, err = s.CreateStage(ctx, sh.id, StageInput{Name: "Bajarildi", Color: "green", Done: true})
	require.NoError(t, err)
	sh.buyurtma = mustType(t, s, sh.id, "Buyurtma")
	sh.izoh = mustField(t, s, sh.id, sh.buyurtma.ID, FieldInput{Label: "Izoh", Kind: "string", Required: true})
	sh.summa = mustField(t, s, sh.id, sh.buyurtma.ID, FieldInput{Label: "Summa", Kind: "int"})
	sh.kanal = mustField(t, s, sh.id, sh.buyurtma.ID, FieldInput{Label: "Kanal", Kind: "checkbox", DropdownID: &sh.manba.ID})
	return sh
}

// answers is a task's (or a customer's) answers as a client sends them: JSON
// by the id of the field.
func answers(t *testing.T, of map[int64]any) map[string]json.RawMessage {
	t.Helper()
	raw := make(map[string]json.RawMessage, len(of))
	for id, answer := range of {
		b, err := json.Marshal(answer)
		require.NoError(t, err)
		raw[strconv.FormatInt(id, 10)] = b
	}
	return raw
}

// existing names the shop's customer Ali as a task's customer.
func (sh shop) existing() CustomerInput { return CustomerInput{ID: &sh.ali.ID} }

// input is a task of the shop's type: the title, due on the day, in the
// first stage, with the answers given.
func (sh shop) input(t *testing.T, title, day string, of map[int64]any) Input {
	t.Helper()
	return Input{Title: title, Deadline: day, StageID: sh.yangi.ID, Values: answers(t, of)}
}

// mustTask enters a task for Ali, as the owner.
func mustTask(t *testing.T, s *Service, sh shop, title, day string, of map[int64]any) Task {
	t.Helper()
	task, err := s.Create(t.Context(), sh.id, owner, sh.buyurtma.ID, sh.input(t, title, day, of), sh.existing())
	require.NoError(t, err)
	return task
}

func day(s string) time.Time {
	d, err := time.Parse(time.DateOnly, s)
	if err != nil {
		panic(err)
	}
	return d
}

// storedHistory is what the history says about the task: each entry as
// "action by phone (name): changes".
func storedHistory(t *testing.T, pool *pgxpool.Pool, taskID int64) []string {
	t.Helper()
	rows, err := pool.Query(t.Context(), `SELECT action || ' by ' || actor_phone || ' (' || COALESCE(actor_name, '-') || '): ' || changes::text
		FROM task_history WHERE task_id = $1 ORDER BY id`, taskID)
	require.NoError(t, err)
	history, err := pgx.CollectRows(rows, pgx.RowTo[string])
	require.NoError(t, err)
	return history
}

func TestCreate(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	sh := newShop(t, s, pool, "Olma")
	in := sh.input(t, " Qo'ng'iroq qilish ", "2026-10-10", map[int64]any{sh.izoh.ID: " Ertalab ", sh.summa.ID: 45000, sh.kanal.ID: []int64{sh.linkedin.ID, sh.instagram.ID}})
	in.AssigneePhone = ptr("+998 90 222 22 22")

	task, err := s.Create(ctx, sh.id, staff, sh.buyurtma.ID, in, sh.existing())

	require.NoError(t, err)
	assert.NotZero(t, task.ID)
	assert.Equal(t, Task{
		ID: task.ID, TypeID: sh.buyurtma.ID, StageID: sh.yangi.ID, Title: "Qo'ng'iroq qilish", Deadline: day("2026-10-10"),
		Customer:      Customer{ID: sh.ali.ID, Phone: "998901234567", Name: ptr("Ali Valiyev")},
		Assignee:      &Member{Phone: staff, Name: ptr("Xurshid Xodim")},
		Values:        fields.Values{sh.izoh.ID: "Ertalab", sh.summa.ID: int64(45000), sh.kanal.ID: []int64{sh.instagram.ID, sh.linkedin.ID}},
		CreatedByName: ptr("Xurshid Xodim"), CreatedAt: task.CreatedAt, UpdatedAt: task.UpdatedAt,
	}, task, "the task as it was entered: the title trimmed, the assignee's phone as kept, the options in their order")
	assert.Equal(t, task.CreatedAt, task.UpdatedAt)
	got, err := s.Get(ctx, sh.id, task.ID)
	require.NoError(t, err)
	assert.Equal(t, task, got)
	assert.Equal(t, []string{"created by 998902222222 (Xurshid Xodim): []"}, storedHistory(t, pool, task.ID))

	unassigned := mustTask(t, s, sh, "Hisob yozish", "2026-10-11", map[int64]any{sh.izoh.ID: "Kech"})
	assert.Nil(t, unassigned.Assignee)
	assert.Equal(t, fields.Values{sh.izoh.ID: "Kech"}, unassigned.Values, "an empty answer has no entry")
}

func TestCreateWithANewCustomer(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	sh := newShop(t, s, pool, "Olma")
	in := sh.input(t, "Shartnoma", "2026-10-10", map[int64]any{sh.izoh.ID: "Yangi mijoz bilan"})
	fresh := CustomerInput{New: &NewCustomer{TypeID: sh.jismoniy.ID, Phone: "+998 90 555 55 55", Values: answers(t, map[int64]any{sh.fish.ID: " Vali Aliyev "})}}

	task, err := s.Create(ctx, sh.id, staff, sh.buyurtma.ID, in, fresh)

	require.NoError(t, err)
	assert.Equal(t, Customer{ID: task.Customer.ID, Phone: "998905555555", Name: ptr("Vali Aliyev")}, task.Customer, "the customer is entered with the task")
	vali, err := sh.customers.Get(ctx, sh.id, task.Customer.ID)
	require.NoError(t, err)
	assert.Equal(t, customer.Values{sh.fish.ID: "Vali Aliyev"}, vali.Values)
	assert.Equal(t, ptr("Xurshid Xodim"), vali.CreatedByName, "by the same member")
	history, err := sh.customers.History(ctx, sh.id, vali.ID)
	require.NoError(t, err)
	require.Len(t, history, 1, "the customer has a history of its own")
	assert.Equal(t, "created", history[0].Action)

	// Ali's phone: the customer is there already, and nothing is entered.
	taken := CustomerInput{New: &NewCustomer{TypeID: sh.jismoniy.ID, Phone: "998901234567", Values: answers(t, map[int64]any{sh.fish.ID: "Ali"})}}
	_, err = s.Create(ctx, sh.id, staff, sh.buyurtma.ID, in, taken)
	refused(t, err, apperr.Conflict, "phone_taken", "Bu raqamli mijoz allaqachon bor")
	var e *customer.TakenError
	if assert.ErrorAs(t, err, &e) {
		assert.Equal(t, sh.ali.ID, e.CustomerID, "the refusal names the customer who has the phone")
	}
	assert.Equal(t, 1, count(t, pool, "SELECT count(*) FROM tasks"), "no task without its customer")
	assert.Equal(t, 2, count(t, pool, "SELECT count(*) FROM customers"))
	_, err = s.Create(ctx, sh.id, staff, sh.buyurtma.ID, in, CustomerInput{New: &NewCustomer{TypeID: sh.jismoniy.ID, Phone: "998906666666"}})
	refused(t, err, apperr.Invalid, "validation_error", "«F.I.Sh.» maydonini to'ldiring", "the new customer's rules hold")
}

func TestCreateRefusals(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	sh := newShop(t, s, pool, "Olma")
	nok := newShop(t, s, pool, "Nok")
	gone := mustType(t, s, sh.id, "Eski")
	require.NoError(t, s.DeleteType(ctx, sh.id, gone.ID))
	// A field of another type: its id is not a customer field's, which
	// may well be the same number.
	shikoyat := mustType(t, s, sh.id, "Shikoyat")
	sabab := mustField(t, s, sh.id, shikoyat.ID, FieldInput{Label: "Sabab", Kind: "string"})
	deletedStage := mustStage(t, s, sh.id, "Eski", "slate")
	require.NoError(t, s.DeleteStage(ctx, sh.id, deletedStage.ID))
	hidden, err := sh.customers.Create(ctx, sh.id, owner, sh.jismoniy.ID, customer.Input{Phone: "998907777777", Values: answers(t, map[int64]any{sh.fish.ID: "Yo'q"})})
	require.NoError(t, err)
	require.NoError(t, sh.customers.Delete(ctx, sh.id, hidden.ID, owner))
	ok := sh.input(t, "Qo'ng'iroq", "2026-10-10", map[int64]any{sh.izoh.ID: "Ertalab"})
	with := func(change func(in *Input)) Input {
		in := ok
		change(&in)
		return in
	}

	for _, tt := range []struct {
		name    string
		typeID  int64
		in      Input
		cust    CustomerInput
		kind    apperr.Kind
		code    string
		message string
	}{
		{name: "no title", typeID: sh.buyurtma.ID, in: with(func(in *Input) { in.Title = " " }), cust: sh.existing(), kind: apperr.Invalid, code: "validation_error", message: "Vazifa nomini kiriting"},
		{name: "no deadline", typeID: sh.buyurtma.ID, in: with(func(in *Input) { in.Deadline = "" }), cust: sh.existing(), kind: apperr.Invalid, code: "validation_error", message: "Muddatni kiriting"},
		{name: "a deadline that is no day", typeID: sh.buyurtma.ID, in: with(func(in *Input) { in.Deadline = "10.10.2026" }), cust: sh.existing(), kind: apperr.Invalid, code: "validation_error", message: "Muddat noto'g'ri"},
		{name: "no type", in: ok, cust: sh.existing(), kind: apperr.Invalid, code: "validation_error", message: "Vazifa turini tanlang"},
		{name: "a deleted type", typeID: gone.ID, in: ok, cust: sh.existing(), kind: apperr.Invalid, code: "validation_error", message: "Vazifa turini tanlang"},
		{name: "another company's type", typeID: nok.buyurtma.ID, in: ok, cust: sh.existing(), kind: apperr.Invalid, code: "validation_error", message: "Vazifa turini tanlang"},
		{name: "no stage", typeID: sh.buyurtma.ID, in: with(func(in *Input) { in.StageID = 0 }), cust: sh.existing(), kind: apperr.Invalid, code: "validation_error", message: "Bosqichni tanlang"},
		{name: "a deleted stage", typeID: sh.buyurtma.ID, in: with(func(in *Input) { in.StageID = deletedStage.ID }), cust: sh.existing(), kind: apperr.Invalid, code: "validation_error", message: "Bosqichni tanlang"},
		{name: "another company's stage", typeID: sh.buyurtma.ID, in: with(func(in *Input) { in.StageID = nok.yangi.ID }), cust: sh.existing(), kind: apperr.Invalid, code: "validation_error", message: "Bosqichni tanlang"},
		{name: "an assignee who is no member", typeID: sh.buyurtma.ID, in: with(func(in *Input) { in.AssigneePhone = ptr(outsider) }), cust: sh.existing(), kind: apperr.Invalid, code: "validation_error", message: "Mas'ul kompaniya a'zosi emas"},
		{name: "an assignee who is no phone", typeID: sh.buyurtma.ID, in: with(func(in *Input) { in.AssigneePhone = ptr("vali") }), cust: sh.existing(), kind: apperr.Invalid, code: "validation_error", message: "Mas'ul kompaniya a'zosi emas"},
		{name: "a field of another type", typeID: sh.buyurtma.ID, in: with(func(in *Input) { in.Values = answers(t, map[int64]any{sh.izoh.ID: "X", sabab.ID: "Ali"}) }), cust: sh.existing(), kind: apperr.Invalid, code: "validation_error", message: "Bu turda bunday maydon yo'q"},
		{name: "a required field left empty", typeID: sh.buyurtma.ID, in: with(func(in *Input) { in.Values = nil }), cust: sh.existing(), kind: apperr.Invalid, code: "validation_error", message: "«Izoh» maydonini to'ldiring"},
		{name: "a number that is no number", typeID: sh.buyurtma.ID, in: with(func(in *Input) { in.Values = answers(t, map[int64]any{sh.izoh.ID: "X", sh.summa.ID: "ko'p"}) }), cust: sh.existing(), kind: apperr.Invalid, code: "validation_error", message: "«Summa» butun son bo'lishi kerak"},
		{name: "no customer", typeID: sh.buyurtma.ID, in: ok, cust: CustomerInput{}, kind: apperr.Invalid, code: "validation_error", message: "Mijozni tanlang"},
		{name: "a customer that is not there", typeID: sh.buyurtma.ID, in: ok, cust: CustomerInput{ID: ptr(sh.ali.ID + 1000)}, kind: apperr.Invalid, code: "validation_error", message: "Mijozni tanlang"},
		{name: "another company's customer", typeID: sh.buyurtma.ID, in: ok, cust: CustomerInput{ID: &nok.ali.ID}, kind: apperr.Invalid, code: "validation_error", message: "Mijozni tanlang"},
		{name: "a deleted customer", typeID: sh.buyurtma.ID, in: ok, cust: CustomerInput{ID: &hidden.ID}, kind: apperr.Invalid, code: "validation_error", message: "Mijozni tanlang"},
		{name: "the title is told before the type", in: with(func(in *Input) { in.Title = "" }), cust: sh.existing(), kind: apperr.Invalid, code: "validation_error", message: "Vazifa nomini kiriting"},
		{name: "the stage is told before the answers", typeID: sh.buyurtma.ID, in: with(func(in *Input) { in.StageID = 0; in.Values = nil }), cust: sh.existing(), kind: apperr.Invalid, code: "validation_error", message: "Bosqichni tanlang"},
		{name: "the answers are told before the customer", typeID: sh.buyurtma.ID, in: with(func(in *Input) { in.Values = nil }), cust: CustomerInput{}, kind: apperr.Invalid, code: "validation_error", message: "«Izoh» maydonini to'ldiring"},
	} {
		_, err := s.Create(ctx, sh.id, owner, tt.typeID, tt.in, tt.cust)
		refused(t, err, tt.kind, tt.code, tt.message, tt.name)
	}
	assert.Zero(t, count(t, pool, "SELECT count(*) FROM tasks"), "nothing is entered")
	assert.Equal(t, 3, count(t, pool, "SELECT count(*) FROM customers"), "no customer is entered either")
}

func TestCreateEntersATaskWhollyOrNotAtAll(t *testing.T) {
	s, pool := newService(t)
	sh := newShop(t, s, pool, "Olma")
	pgtest.FailInserts(t, pool, "tasks")
	fresh := CustomerInput{New: &NewCustomer{TypeID: sh.jismoniy.ID, Phone: "998905555555", Values: answers(t, map[int64]any{sh.fish.ID: "Vali"})}}

	_, err := s.Create(t.Context(), sh.id, staff, sh.buyurtma.ID, sh.input(t, "Shartnoma", "2026-10-10", map[int64]any{sh.izoh.ID: "X"}), fresh)

	require.Error(t, err)
	assert.Equal(t, 1, count(t, pool, "SELECT count(*) FROM customers"), "no new customer without its task")
	assert.Zero(t, count(t, pool, "SELECT count(*) FROM task_history"))
}

func TestGet(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	sh := newShop(t, s, pool, "Olma")
	nok := newShop(t, s, pool, "Nok")
	in := sh.input(t, "Qo'ng'iroq", "2026-10-10", map[int64]any{sh.izoh.ID: "Ertalab"})
	in.AssigneePhone = ptr(staff)
	task, err := s.Create(ctx, sh.id, owner, sh.buyurtma.ID, in, sh.existing())
	require.NoError(t, err)

	_, err = pool.Exec(ctx, "DELETE FROM user_companies WHERE user_phone = $1 AND company_id = $2", staff, sh.id)
	require.NoError(t, err)
	got, err := s.Get(ctx, sh.id, task.ID)
	require.NoError(t, err)
	assert.Equal(t, &Member{Phone: staff, Name: ptr("Xurshid Xodim")}, got.Assignee, "an assignee who left the company keeps the name of then")
	assert.Equal(t, ptr("Egamberdi Egasi"), got.CreatedByName)

	const notFound = "Vazifa topilmadi"
	_, err = s.Get(ctx, nok.id, task.ID)
	refused(t, err, apperr.NotFound, "not_found", notFound, "another company's task")
	_, err = s.Get(ctx, sh.id, task.ID+1000)
	refused(t, err, apperr.NotFound, "not_found", notFound, "no such task")
	require.NoError(t, s.Delete(ctx, sh.id, task.ID, owner))
	_, err = s.Get(ctx, sh.id, task.ID)
	refused(t, err, apperr.NotFound, "not_found", notFound, "a deleted task")
}

// titlesOf is the titles of the tasks, in their order.
func titlesOf(tasks []Task) []string {
	list := make([]string, 0, len(tasks))
	for _, task := range tasks {
		list = append(list, task.Title)
	}
	return list
}

func TestList(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	sh := newShop(t, s, pool, "Olma")
	nok := newShop(t, s, pool, "Nok")
	mustTask(t, s, nok, "Begona", "2026-10-01", map[int64]any{nok.izoh.ID: "X"})
	later := mustTask(t, s, sh, "Hisob yozish", "2026-10-12", map[int64]any{sh.izoh.ID: "Ertalab yozish", sh.summa.ID: 45000})
	in := sh.input(t, "Qo'ng'iroq qilish", "2026-10-10", map[int64]any{sh.izoh.ID: "X"})
	in.AssigneePhone = ptr(staff)
	sooner, err := s.Create(ctx, sh.id, owner, sh.buyurtma.ID, in, sh.existing())
	require.NoError(t, err)
	soonest := mustTask(t, s, sh, "Shartnoma", "2026-10-09", map[int64]any{sh.izoh.ID: "X"})
	shikoyat := mustType(t, s, sh.id, "Shikoyat")
	other, err := s.Create(ctx, sh.id, owner, shikoyat.ID, Input{Title: "Shikoyatni ko'rish", Deadline: "2026-10-10", StageID: sh.bajarildi.ID},
		CustomerInput{New: &NewCustomer{TypeID: sh.jismoniy.ID, Phone: "998905555555", Values: answers(t, map[int64]any{sh.fish.ID: "Zarina Karimova", sh.yosh.ID: 37})}})
	require.NoError(t, err)
	gone := mustTask(t, s, sh, "O'chirilgan", "2026-10-01", map[int64]any{sh.izoh.ID: "X"})
	require.NoError(t, s.Delete(ctx, sh.id, gone.ID, owner))

	page, err := s.List(ctx, sh.id, ListInput{Page: 1})

	require.NoError(t, err)
	assert.Equal(t, []string{"Shartnoma", "Qo'ng'iroq qilish", "Shikoyatni ko'rish", "Hisob yozish"}, titlesOf(page.Items),
		"the one due soonest first, the older task before the newer of one day; the deleted one and another company's are out")
	assert.Equal(t, []Task{soonest, sooner, other, later}, page.Items, "each with its answers, customer and assignee")
	assert.EqualValues(t, 4, page.Total)
	assert.Equal(t, 1, page.Page)
	assert.Equal(t, 20, page.PageSize)

	for about, tc := range map[string]struct {
		in   ListInput
		want []string
	}{
		"of one type":                               {ListInput{TypeID: shikoyat.ID, Page: 1}, []string{"Shikoyatni ko'rish"}},
		"in one stage":                              {ListInput{StageID: sh.yangi.ID, Page: 1}, []string{"Shartnoma", "Qo'ng'iroq qilish", "Hisob yozish"}},
		"of one assignee":                           {ListInput{Assignee: "+998 90 222 22 22", Page: 1}, []string{"Qo'ng'iroq qilish"}},
		"of one customer":                           {ListInput{CustomerID: other.Customer.ID, Page: 1}, []string{"Shikoyatni ko'rish"}},
		"a search in the title":                     {ListInput{Search: "qo'ng", Page: 1}, []string{"Qo'ng'iroq qilish"}},
		"a search in the task's answers":            {ListInput{Search: "ERTALAB", Page: 1}, []string{"Hisob yozish"}},
		"a search in the customer's name":           {ListInput{Search: "karim", Page: 1}, []string{"Shikoyatni ko'rish"}},
		"a number in the customer's phone":          {ListInput{Search: "90 555", Page: 1}, []string{"Shikoyatni ko'rish"}},
		"a number in the customer's number answers": {ListInput{Search: "37", Page: 1}, []string{"Shikoyatni ko'rish"}},
		"a number in the task's answers":            {ListInput{Search: "450", Page: 1}, []string{"Hisob yozish"}},
		"a search that finds nothing":               {ListInput{Search: "yo'q", Page: 1}, []string{}},
		"a stage and a search together":             {ListInput{StageID: sh.yangi.ID, Search: "karim", Page: 1}, []string{}},
		"a page past the last":                      {ListInput{Page: 2}, []string{}},
	} {
		page, err := s.List(ctx, sh.id, tc.in)
		require.NoError(t, err, about)
		assert.Equal(t, tc.want, titlesOf(page.Items), about)
	}
	for _, page := range []int{0, -1, 1_000_001} {
		_, err = s.List(ctx, sh.id, ListInput{Page: page})
		refused(t, err, apperr.Invalid, "validation_error", "Sahifa raqami noto'g'ri", page)
	}
	_, err = s.List(ctx, sh.id, ListInput{Assignee: "vali", Page: 1})
	refused(t, err, apperr.Invalid, "validation_error", "Mas'ul noto'g'ri")
}

func TestListPages(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	sh := newShop(t, s, pool, "Olma")
	for i := range 21 {
		mustTask(t, s, sh, fmt.Sprintf("Vazifa %02d", i), fmt.Sprintf("2026-11-%02d", i+1), map[int64]any{sh.izoh.ID: "X"})
	}

	first, err := s.List(ctx, sh.id, ListInput{Page: 1})
	require.NoError(t, err)
	require.Len(t, first.Items, 20, "a page holds twenty")
	assert.Equal(t, "Vazifa 00", first.Items[0].Title)
	assert.EqualValues(t, 21, first.Total)
	second, err := s.List(ctx, sh.id, ListInput{Page: 2})
	require.NoError(t, err)
	assert.Equal(t, []string{"Vazifa 20"}, titlesOf(second.Items), "the one due last is on the last page")
	assert.Equal(t, 2, second.Page)
}

func TestUpdate(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	sh := newShop(t, s, pool, "Olma")
	task := mustTask(t, s, sh, "Qo'ng'iroq", "2026-10-10", map[int64]any{sh.izoh.ID: "Ertalab", sh.summa.ID: 45000, sh.kanal.ID: []int64{sh.instagram.ID}})
	_, err := pool.Exec(ctx, "UPDATE tasks SET updated_at = created_at - interval '1 hour' WHERE id = $1", task.ID)
	require.NoError(t, err)

	edited, err := s.Update(ctx, sh.id, task.ID, staff, Input{
		Title: " Qayta qo'ng'iroq ", Deadline: "2026-10-12", StageID: sh.jarayonda.ID, AssigneePhone: ptr(staff),
		Values: answers(t, map[int64]any{sh.izoh.ID: "Kechqurun", sh.kanal.ID: []int64{sh.linkedin.ID, sh.instagram.ID}}),
	})

	require.NoError(t, err)
	assert.Equal(t, "Qayta qo'ng'iroq", edited.Title)
	assert.Equal(t, day("2026-10-12"), edited.Deadline)
	assert.Equal(t, sh.jarayonda.ID, edited.StageID)
	assert.Equal(t, &Member{Phone: staff, Name: ptr("Xurshid Xodim")}, edited.Assignee)
	assert.Equal(t, fields.Values{sh.izoh.ID: "Kechqurun", sh.kanal.ID: []int64{sh.instagram.ID, sh.linkedin.ID}}, edited.Values, "an answer left out is taken away")
	assert.Equal(t, task.Customer, edited.Customer, "the customer stays")
	assert.True(t, edited.UpdatedAt.After(task.CreatedAt), "the moment of the edit")
	got, err := s.Get(ctx, sh.id, task.ID)
	require.NoError(t, err)
	assert.Equal(t, edited, got)
	assert.Equal(t, []string{
		"created by 998901111111 (Egamberdi Egasi): []",
		`updated by 998902222222 (Xurshid Xodim): [{"new": "Qayta qo'ng'iroq", "old": "Qo'ng'iroq", "label": "Nomi"}, ` +
			`{"new": "12.10.2026", "old": "10.10.2026", "label": "Muddat"}, {"new": "Jarayonda", "old": "Yangi", "label": "Bosqich"}, ` +
			`{"new": "Xurshid Xodim", "old": "", "label": "Mas'ul"}, {"new": "Kechqurun", "old": "Ertalab", "label": "Izoh"}, ` +
			`{"new": "", "old": "45000", "label": "Summa"}, {"new": "Instagram, LinkedIn", "old": "Instagram", "label": "Kanal"}]`,
	}, storedHistory(t, pool, task.ID), "what changed, in order: the task's own fields, then the type's")
}

func TestUpdateThatChangesNothingWritesNothing(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	sh := newShop(t, s, pool, "Olma")
	in := sh.input(t, "Qo'ng'iroq", "2026-10-10", map[int64]any{sh.izoh.ID: "Ertalab", sh.kanal.ID: []int64{sh.youtube.ID, sh.instagram.ID}})
	in.AssigneePhone = ptr(staff)
	// The owner turns YouTube back on for a moment to enter the task with it.
	_, err := sh.customers.UpdateOption(ctx, sh.id, sh.manba.ID, sh.youtube.ID, customer.OptionPatch{Active: ptr(true)})
	require.NoError(t, err)
	task, err := s.Create(ctx, sh.id, owner, sh.buyurtma.ID, in, sh.existing())
	require.NoError(t, err)
	_, err = sh.customers.UpdateOption(ctx, sh.id, sh.manba.ID, sh.youtube.ID, customer.OptionPatch{Active: ptr(false)})
	require.NoError(t, err)
	// The assignee leaves the company meanwhile.
	_, err = pool.Exec(ctx, "DELETE FROM user_companies WHERE user_phone = $1 AND company_id = $2", staff, sh.id)
	require.NoError(t, err)

	same, err := s.Update(ctx, sh.id, task.ID, owner, Input{
		Title: "Qo'ng'iroq", Deadline: "2026-10-10", StageID: sh.yangi.ID, AssigneePhone: ptr(staff),
		Values: answers(t, map[int64]any{sh.izoh.ID: "Ertalab", sh.kanal.ID: []int64{sh.instagram.ID, sh.youtube.ID}}),
	})

	require.NoError(t, err)
	assert.Equal(t, task, same, "the task as it was: the option turned off stays, the assignee who left stays")
	assert.Len(t, storedHistory(t, pool, task.ID), 1, "nothing to write down")

	_, err = s.Update(ctx, sh.id, task.ID, owner, Input{Title: "Qo'ng'iroq", Deadline: "2026-10-10", StageID: sh.yangi.ID, AssigneePhone: ptr(outsider),
		Values: answers(t, map[int64]any{sh.izoh.ID: "Ertalab"})})
	refused(t, err, apperr.Invalid, "validation_error", "Mas'ul kompaniya a'zosi emas", "another assignee has to be a member")
}

func TestUpdateRefusals(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	sh := newShop(t, s, pool, "Olma")
	nok := newShop(t, s, pool, "Nok")
	task := mustTask(t, s, sh, "Qo'ng'iroq", "2026-10-10", map[int64]any{sh.izoh.ID: "Ertalab"})
	ok := Input{Title: "Qo'ng'iroq", Deadline: "2026-10-10", StageID: sh.yangi.ID, Values: answers(t, map[int64]any{sh.izoh.ID: "Ertalab"})}

	_, err := s.Update(ctx, nok.id, task.ID, owner, ok)
	refused(t, err, apperr.NotFound, "not_found", "Vazifa topilmadi", "another company's task")
	_, err = s.Update(ctx, sh.id, task.ID+1000, owner, Input{})
	refused(t, err, apperr.NotFound, "not_found", "Vazifa topilmadi", "no such task: told before what is wrong with the input")
	for _, tt := range []struct {
		name    string
		change  func(in *Input)
		message string
	}{
		{"no title", func(in *Input) { in.Title = "" }, "Vazifa nomini kiriting"},
		{"a bad deadline", func(in *Input) { in.Deadline = "soon" }, "Muddat noto'g'ri"},
		{"another company's stage", func(in *Input) { in.StageID = nok.yangi.ID }, "Bosqichni tanlang"},
		{"a required field left empty", func(in *Input) { in.Values = nil }, "«Izoh» maydonini to'ldiring"},
	} {
		in := ok
		tt.change(&in)
		_, err := s.Update(ctx, sh.id, task.ID, owner, in)
		refused(t, err, apperr.Invalid, "validation_error", tt.message, tt.name)
	}
	got, err := s.Get(ctx, sh.id, task.ID)
	require.NoError(t, err)
	assert.Equal(t, task, got, "a refusal changes nothing")
}

func TestMove(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	sh := newShop(t, s, pool, "Olma")
	nok := newShop(t, s, pool, "Nok")
	task := mustTask(t, s, sh, "Qo'ng'iroq", "2026-10-10", map[int64]any{sh.izoh.ID: "Ertalab"})

	moved, err := s.Move(ctx, sh.id, task.ID, staff, sh.bajarildi.ID)

	require.NoError(t, err)
	assert.Equal(t, sh.bajarildi.ID, moved.StageID)
	assert.Equal(t, task.Title, moved.Title, "nothing else changes")
	assert.Equal(t, task.Values, moved.Values)
	assert.Equal(t, []string{
		"created by 998901111111 (Egamberdi Egasi): []",
		`updated by 998902222222 (Xurshid Xodim): [{"new": "Bajarildi", "old": "Yangi", "label": "Bosqich"}]`,
	}, storedHistory(t, pool, task.ID))

	again, err := s.Move(ctx, sh.id, task.ID, staff, sh.bajarildi.ID)
	require.NoError(t, err)
	assert.Equal(t, moved, again, "the same stage changes nothing")
	assert.Len(t, storedHistory(t, pool, task.ID), 2, "and writes nothing")

	_, err = s.Move(ctx, sh.id, task.ID, staff, nok.yangi.ID)
	refused(t, err, apperr.Invalid, "validation_error", "Bosqichni tanlang", "another company's stage")
	_, err = s.Move(ctx, nok.id, task.ID, staff, nok.yangi.ID)
	refused(t, err, apperr.NotFound, "not_found", "Vazifa topilmadi", "another company's task")
}

func TestDelete(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	sh := newShop(t, s, pool, "Olma")
	nok := newShop(t, s, pool, "Nok")
	task := mustTask(t, s, sh, "Qo'ng'iroq", "2026-10-10", map[int64]any{sh.izoh.ID: "Ertalab"})

	require.NoError(t, s.Delete(ctx, sh.id, task.ID, staff))

	page, err := s.List(ctx, sh.id, ListInput{Page: 1})
	require.NoError(t, err)
	assert.Empty(t, page.Items, "the task is gone from the list")
	assert.Equal(t, 1, count(t, pool, "SELECT count(*) FROM tasks"), "nothing leaves the database")
	assert.Equal(t, 1, count(t, pool, "SELECT count(*) FROM task_values"), "its answers stay")
	assert.Equal(t, []string{
		"created by 998901111111 (Egamberdi Egasi): []",
		"deleted by 998902222222 (Xurshid Xodim): []",
	}, storedHistory(t, pool, task.ID))

	const notFound = "Vazifa topilmadi"
	refused(t, s.Delete(ctx, sh.id, task.ID, staff), apperr.NotFound, "not_found", notFound, "deleted already")
	refused(t, s.Delete(ctx, nok.id, task.ID, staff), apperr.NotFound, "not_found", notFound, "another company's task")
}

func TestHistory(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	sh := newShop(t, s, pool, "Olma")
	task := mustTask(t, s, sh, "Qo'ng'iroq", "2026-10-10", map[int64]any{sh.izoh.ID: "Ertalab"})
	_, err := s.Move(ctx, sh.id, task.ID, staff, sh.jarayonda.ID)
	require.NoError(t, err)

	history, err := s.History(ctx, sh.id, task.ID)

	require.NoError(t, err)
	require.Len(t, history, 2)
	assert.Equal(t, "updated", history[0].Action, "the latest first")
	assert.Equal(t, ptr("Xurshid Xodim"), history[0].ActorName)
	assert.Equal(t, []fields.Change{{Label: "Bosqich", Old: "Yangi", New: "Jarayonda"}}, history[0].Changes)
	assert.Equal(t, "created", history[1].Action)
	assert.Equal(t, []fields.Change{}, history[1].Changes, "an empty list, not nil")
	assert.False(t, history[0].CreatedAt.Before(history[1].CreatedAt))

	require.NoError(t, s.Delete(ctx, sh.id, task.ID, owner))
	_, err = s.History(ctx, sh.id, task.ID)
	refused(t, err, apperr.NotFound, "not_found", "Vazifa topilmadi", "a deleted task's history is kept, not shown")
}
