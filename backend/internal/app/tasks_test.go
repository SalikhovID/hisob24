package app

import (
	"fmt"
	"net/http"
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// taskShop is what a company is set up with for tasks, beside its
// customers: the stages Yangi, Jarayonda and Bajarildi (done), and the type
// Buyurtma with a required text Izoh, a number Summa and a checkbox Kanal
// over the customers' dropdown Manba.
type taskShop struct {
	customerShop
	yangi, jarayonda, bajarildi int64
	buyurtma                    int64
	izoh, summa, kanal          int64
}

func (api testAPI) taskShop(t *testing.T, companyID int64) taskShop {
	t.Helper()
	sh := taskShop{customerShop: api.customerShop(t, companyID)}
	sh.yangi = api.addStage(t, companyID, "Yangi", "blue", false, 1)
	sh.jarayonda = api.addStage(t, companyID, "Jarayonda", "amber", false, 2)
	sh.bajarildi = api.addStage(t, companyID, "Bajarildi", "green", true, 3)
	sh.buyurtma = api.addTaskType(t, companyID, "Buyurtma", 1)
	manba := api.id(t, "SELECT dropdown_id FROM customer_fields WHERE id = $1", sh.manba)
	sh.izoh = api.id(t, `INSERT INTO task_fields (company_id, type_id, label, kind, required, position)
		VALUES ($1, $2, 'Izoh', 'string', true, 1) RETURNING id`, companyID, sh.buyurtma)
	sh.summa = api.id(t, `INSERT INTO task_fields (company_id, type_id, label, kind, position)
		VALUES ($1, $2, 'Summa', 'int', 2) RETURNING id`, companyID, sh.buyurtma)
	sh.kanal = api.id(t, `INSERT INTO task_fields (company_id, type_id, label, kind, dropdown_id, position)
		VALUES ($1, $2, 'Kanal', 'checkbox', $3, 3) RETURNING id`, companyID, sh.buyurtma, manba)
	return sh
}

// taskBody is a body for POST /app/tasks: a task of the type Buyurtma with
// the title, due on the day, in the stage, for the customer that is there,
// with the answers (JSON) and whatever else the caller adds (",key":value).
func taskBody(sh taskShop, title, deadline string, stageID int64, customerID any, values, extra string) string {
	return fmt.Sprintf(`{"type_id":%d,"title":%q,"deadline":%q,"stage_id":%d,"values":%s,"customer":{"id":%v}%s}`,
		sh.buyurtma, title, deadline, stageID, values, customerID, extra)
}

// enterTask enters a task through the API, as the member the token is of,
// and returns it as the API answers.
func (api testAPI) enterTask(t *testing.T, token, body string) map[string]any {
	t.Helper()
	rec := api.do(t, http.MethodPost, "/app/tasks", body, bearer(token))
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	return decode(t, rec)
}

const taskNotFound = `{"error":"not_found","message":"Vazifa topilmadi"}`

func TestCreateTask(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	undecided, _ := api.signIn(t, sardorsPhone, map[int64]string{olma: "user", nok: "owner"})
	api.exec(t, "UPDATE user_companies SET full_name = 'Vali Aliyev' WHERE user_phone = $1", valisPhone)
	sh := api.taskShop(t, olma)
	ali := api.enter(t, owner, sh.jismoniy, "998901112233", fmt.Sprintf(`{"%d":"Ali Valiyev"}`, sh.fish))

	rec := api.do(t, http.MethodPost, "/app/tasks", taskBody(sh, " Qo'ng'iroq qilish ", "2026-10-10", sh.yangi, ali["id"],
		fmt.Sprintf(`{"%d":" Ertalab ","%d":45000,"%d":[%d,%d]}`, sh.izoh, sh.summa, sh.kanal, sh.linkedin, sh.instagram),
		`,"assignee_phone":"+998 90 123 45 67"`), bearer(employee))

	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	task := decode(t, rec)
	assert.NotEmpty(t, task["id"])
	assert.EqualValues(t, sh.buyurtma, task["type_id"])
	assert.EqualValues(t, sh.yangi, task["stage_id"])
	assert.Equal(t, "Qo'ng'iroq qilish", task["title"], "an employee enters a task; the title without the spaces around it")
	assert.Equal(t, "2026-10-10", task["deadline"], "a day, as it was sent")
	assert.Equal(t, map[string]any{"id": ali["id"], "phone": "998901112233", "name": "Ali Valiyev"}, task["customer"], "the customer by its name")
	assert.Equal(t, map[string]any{"phone": alisPhone, "full_name": nil}, task["assignee"], "the assignee's phone as kept, by the name they go by")
	assert.Equal(t, map[string]any{
		key(sh.izoh): "Ertalab", key(sh.summa): float64(45000), key(sh.kanal): []any{float64(sh.instagram), float64(sh.linkedin)},
	}, task["values"], "the answers by the id of the field, the options in their order")
	assert.Equal(t, "Vali Aliyev", task["created_by_name"], "under the name they go by in the company")
	assert.NotEmpty(t, task["created_at"])
	assert.Equal(t, task["created_at"], task["updated_at"])

	rec = api.do(t, http.MethodPost, "/app/tasks", fmt.Sprintf(
		`{"type_id":%d,"title":"Shartnoma","deadline":"2026-10-11","stage_id":%d,"values":{"%d":"Yangi mijoz bilan"},`+
			`"customer":{"type_id":%d,"phone":"+998 90 111 22 44","values":{"%d":" Vali Aliyev "}}}`,
		sh.buyurtma, sh.yangi, sh.izoh, sh.jismoniy, sh.fish), bearer(owner))
	require.Equal(t, http.StatusCreated, rec.Code, "with a new customer: %s", rec.Body.String())
	task = decode(t, rec)
	vali, _ := task["customer"].(map[string]any)
	assert.Equal(t, "998901112244", vali["phone"], "the customer is entered with the task")
	assert.Equal(t, "Vali Aliyev", vali["name"])
	assert.Nil(t, task["assignee"], "assigned to nobody")
	assert.Nil(t, task["created_by_name"], "the owner goes by no name")
	rec = api.do(t, http.MethodGet, fmt.Sprintf("/app/customers/%v", vali["id"]), "", bearer(owner))
	assert.Equal(t, http.StatusOK, rec.Code, "and is there to read: %s", rec.Body.String())

	rec = api.do(t, http.MethodPost, "/app/tasks", fmt.Sprintf(
		`{"type_id":%d,"title":"Shartnoma","deadline":"2026-10-11","stage_id":%d,"values":{"%d":"X"},`+
			`"customer":{"type_id":%d,"phone":"998901112233","values":{"%d":"Ali"}}}`,
		sh.buyurtma, sh.yangi, sh.izoh, sh.jismoniy, sh.fish), bearer(owner))
	assert.Equal(t, http.StatusConflict, rec.Code)
	assert.JSONEq(t, fmt.Sprintf(`{"error":"phone_taken","message":"Bu raqamli mijoz allaqachon bor","customer_id":%v}`, ali["id"]),
		rec.Body.String(), "the refusal names the customer who has the phone")

	ok := fmt.Sprintf(`{"%d":"X"}`, sh.izoh)
	for _, tt := range []struct{ name, body, message string }{
		{"no title", taskBody(sh, " ", "2026-10-10", sh.yangi, ali["id"], ok, ""), "Vazifa nomini kiriting"},
		{"no deadline", taskBody(sh, "X", "", sh.yangi, ali["id"], ok, ""), "Muddatni kiriting"},
		{"a deadline that is no day", taskBody(sh, "X", "10.10.2026", sh.yangi, ali["id"], ok, ""), "Muddat noto'g'ri"},
		{"no type", fmt.Sprintf(`{"title":"X","deadline":"2026-10-10","stage_id":%d,"customer":{"id":%v}}`, sh.yangi, ali["id"]), "Vazifa turini tanlang"},
		{"no stage", taskBody(sh, "X", "2026-10-10", 0, ali["id"], ok, ""), "Bosqichni tanlang"},
		{"an assignee who is no member", taskBody(sh, "X", "2026-10-10", sh.yangi, ali["id"], ok, `,"assignee_phone":"998907777777"`), "Mas'ul kompaniya a'zosi emas"},
		{"a required field left empty", taskBody(sh, "X", "2026-10-10", sh.yangi, ali["id"], `{}`, ""), "«Izoh» maydonini to'ldiring"},
		{"no customer", fmt.Sprintf(`{"type_id":%d,"title":"X","deadline":"2026-10-10","stage_id":%d,"values":%s}`, sh.buyurtma, sh.yangi, ok), "Mijozni tanlang"},
		{"an empty customer", fmt.Sprintf(`{"type_id":%d,"title":"X","deadline":"2026-10-10","stage_id":%d,"values":%s,"customer":{}}`, sh.buyurtma, sh.yangi, ok), "Mijozni tanlang"},
		{"a customer that is not there", taskBody(sh, "X", "2026-10-10", sh.yangi, 999999, ok, ""), "Mijozni tanlang"},
		{"a new customer with no name", fmt.Sprintf(`{"type_id":%d,"title":"X","deadline":"2026-10-10","stage_id":%d,"values":%s,`+
			`"customer":{"type_id":%d,"phone":"998901112266"}}`, sh.buyurtma, sh.yangi, ok, sh.jismoniy), "«F.I.Sh.» maydonini to'ldiring"},
	} {
		rec := api.do(t, http.MethodPost, "/app/tasks", tt.body, bearer(owner))
		assert.Equal(t, http.StatusBadRequest, rec.Code, tt.name)
		assert.JSONEq(t, fmt.Sprintf(`{"error":"validation_error","message":%q}`, tt.message), rec.Body.String(), tt.name)
	}
	assert.Equal(t, http.StatusBadRequest, api.do(t, http.MethodPost, "/app/tasks", `{"type_id":`, bearer(owner)).Code, "not JSON")
	assert.Equal(t, http.StatusBadRequest, api.do(t, http.MethodPost, "/app/tasks",
		taskBody(sh, "X", "2026-10-10", sh.yangi, ali["id"], `["X"]`, ""), bearer(owner)).Code, "values that are no object")

	rec = api.do(t, http.MethodPost, "/app/tasks", `{}`, bearer(undecided))
	assert.Equal(t, http.StatusForbidden, rec.Code, "a session that has not chosen a company yet")
	assert.JSONEq(t, companyRequired, rec.Body.String())
	assert.Equal(t, http.StatusUnauthorized, api.do(t, http.MethodPost, "/app/tasks", `{}`).Code, "no access token")
}

func TestGetTask(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	undecided, _ := api.signIn(t, sardorsPhone, map[int64]string{olma: "user", nok: "owner"})
	stranger, _ := api.signIn(t, "998907777777", map[int64]string{nok: "user"})
	sh := api.taskShop(t, olma)
	ali := api.enter(t, owner, sh.jismoniy, "998901112233", fmt.Sprintf(`{"%d":"Ali Valiyev"}`, sh.fish))
	task := api.enterTask(t, owner, taskBody(sh, "Qo'ng'iroq", "2026-10-10", sh.yangi, ali["id"],
		fmt.Sprintf(`{"%d":"Ertalab","%d":[%d]}`, sh.izoh, sh.kanal, sh.linkedin), fmt.Sprintf(`,"assignee_phone":%q`, valisPhone)))
	path := fmt.Sprintf("/app/tasks/%v", task["id"])

	rec := api.do(t, http.MethodGet, path, "", bearer(employee))

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, task, decode(t, rec), "any member reads the task as it was entered")

	rec = api.do(t, http.MethodGet, path, "", bearer(stranger))
	assert.Equal(t, http.StatusNotFound, rec.Code, "another company's task")
	assert.JSONEq(t, taskNotFound, rec.Body.String())
	assert.Equal(t, http.StatusNotFound, api.do(t, http.MethodGet, "/app/tasks/999999", "", bearer(owner)).Code, "a task that is not there")
	rec = api.do(t, http.MethodGet, "/app/tasks/abc", "", bearer(owner))
	assert.Equal(t, http.StatusNotFound, rec.Code, "an id that is no number")
	assert.JSONEq(t, taskNotFound, rec.Body.String())
	rec = api.do(t, http.MethodGet, path, "", bearer(undecided))
	assert.Equal(t, http.StatusForbidden, rec.Code, "a session that has not chosen a company yet")
	assert.JSONEq(t, companyRequired, rec.Body.String())
	assert.Equal(t, http.StatusUnauthorized, api.do(t, http.MethodGet, path, "").Code, "no access token")
}

func TestListTasks(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	undecided, _ := api.signIn(t, sardorsPhone, map[int64]string{olma: "user", nok: "owner"})
	stranger, _ := api.signIn(t, "998907777777", map[int64]string{nok: "user"})
	sh := api.taskShop(t, olma)
	shikoyat := api.addTaskType(t, olma, "Shikoyat", 2)
	ali := api.enter(t, owner, sh.jismoniy, "998901112233", fmt.Sprintf(`{"%d":"Ali Valiyev"}`, sh.fish))
	zarina := api.enter(t, owner, sh.jismoniy, "998905555555", fmt.Sprintf(`{"%d":"Zarina Karimova"}`, sh.fish))
	later := api.enterTask(t, owner, taskBody(sh, "Hisob yozish", "2026-10-12", sh.yangi, ali["id"],
		fmt.Sprintf(`{"%d":"Ertalab yozish","%d":45000}`, sh.izoh, sh.summa), ""))
	sooner := api.enterTask(t, employee, taskBody(sh, "Qo'ng'iroq qilish", "2026-10-10", sh.yangi, ali["id"],
		fmt.Sprintf(`{"%d":"X"}`, sh.izoh), fmt.Sprintf(`,"assignee_phone":%q`, valisPhone)))
	other := api.enterTask(t, owner, fmt.Sprintf(`{"type_id":%d,"title":"Shikoyatni ko'rish","deadline":"2026-10-10","stage_id":%d,"customer":{"id":%v}}`,
		shikoyat, sh.bajarildi, zarina["id"]))
	begona := api.taskShop(t, nok)
	strangers := api.enter(t, stranger, begona.jismoniy, "998901112233", fmt.Sprintf(`{"%d":"Ali Begona"}`, begona.fish))
	api.enterTask(t, stranger, taskBody(begona, "Begona", "2026-10-01", begona.yangi, strangers["id"], fmt.Sprintf(`{"%d":"X"}`, begona.izoh), ""))
	// get reads a page of Olma's tasks as its employee.
	get := func(query url.Values) map[string]any {
		t.Helper()
		rec := api.do(t, http.MethodGet, "/app/tasks?"+query.Encode(), "", bearer(employee))
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
		return decode(t, rec)
	}

	page := get(nil)

	assert.Equal(t, []any{sooner, other, later}, page["items"],
		"the company's tasks, the one due soonest first and the older before the newer of one day, each as it is read alone")
	assert.EqualValues(t, 3, page["total"])
	assert.EqualValues(t, 1, page["page"])
	assert.EqualValues(t, 20, page["page_size"])

	assert.Equal(t, []any{other}, get(url.Values{"type_id": {fmt.Sprint(shikoyat)}})["items"], "one type")
	assert.Equal(t, []any{sooner, later}, get(url.Values{"stage_id": {fmt.Sprint(sh.yangi)}})["items"], "one stage")
	assert.Equal(t, []any{sooner}, get(url.Values{"assignee": {valisPhone}})["items"], "one assignee")
	found := get(url.Values{"customer_id": {fmt.Sprint(zarina["id"])}})
	assert.Equal(t, []any{other}, found["items"], "one customer")
	assert.EqualValues(t, 1, found["total"])
	assert.Equal(t, []any{sooner}, get(url.Values{"search": {"qo'ng"}})["items"], "a search in the titles")
	assert.Equal(t, []any{later}, get(url.Values{"search": {"ERTALAB"}})["items"], "in the tasks' text answers")
	assert.Equal(t, []any{other}, get(url.Values{"search": {"karim"}})["items"], "in the customers' names")
	assert.Equal(t, []any{other}, get(url.Values{"search": {"90 555"}})["items"], "a number in the customers' phones")
	assert.Equal(t, []any{later}, get(url.Values{"search": {"450"}})["items"], "and in the tasks' number answers")
	assert.Equal(t, []any{}, get(url.Values{"stage_id": {fmt.Sprint(sh.yangi)}, "search": {"karim"}})["items"], "the filters work together")
	past := get(url.Values{"page": {"2"}})
	assert.Equal(t, []any{}, past["items"], "a page past the last")
	assert.EqualValues(t, 3, past["total"])
	assert.EqualValues(t, 2, past["page"])

	for query, message := range map[string]string{
		"page=abc":        "Sahifa raqami noto'g'ri",
		"page=0":          "Sahifa raqami noto'g'ri",
		"type_id=abc":     "Vazifa turi noto'g'ri",
		"type_id=0":       "Vazifa turi noto'g'ri",
		"stage_id=abc":    "Bosqich noto'g'ri",
		"customer_id=abc": "Mijoz noto'g'ri",
		"assignee=vali":   "Mas'ul noto'g'ri",
	} {
		rec := api.do(t, http.MethodGet, "/app/tasks?"+query, "", bearer(owner))
		assert.Equal(t, http.StatusBadRequest, rec.Code, query)
		assert.JSONEq(t, fmt.Sprintf(`{"error":"validation_error","message":%q}`, message), rec.Body.String(), query)
	}
	rec := api.do(t, http.MethodGet, "/app/tasks", "", bearer(undecided))
	assert.Equal(t, http.StatusForbidden, rec.Code, "a session that has not chosen a company yet")
	assert.JSONEq(t, companyRequired, rec.Body.String())
	assert.Equal(t, http.StatusUnauthorized, api.do(t, http.MethodGet, "/app/tasks", "").Code, "no access token")
}

func TestUpdateTask(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	stranger, _ := api.signIn(t, "998907777777", map[int64]string{nok: "user"})
	api.exec(t, "UPDATE user_companies SET full_name = 'Vali Aliyev' WHERE user_phone = $1", valisPhone)
	sh := api.taskShop(t, olma)
	ali := api.enter(t, owner, sh.jismoniy, "998901112233", fmt.Sprintf(`{"%d":"Ali Valiyev"}`, sh.fish))
	task := api.enterTask(t, owner, taskBody(sh, "Qo'ng'iroq", "2026-10-10", sh.yangi, ali["id"],
		fmt.Sprintf(`{"%d":"Ertalab","%d":45000}`, sh.izoh, sh.summa), ""))
	path := fmt.Sprintf("/app/tasks/%v", task["id"])
	body := fmt.Sprintf(`{"title":" Qayta qo'ng'iroq ","deadline":"2026-10-12","stage_id":%d,"assignee_phone":%q,"values":{"%d":"Kechqurun"}}`,
		sh.jarayonda, valisPhone, sh.izoh)

	rec := api.do(t, http.MethodPut, path, body, bearer(employee))

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	edited := decode(t, rec)
	assert.Equal(t, "Qayta qo'ng'iroq", edited["title"], "any member edits a task")
	assert.Equal(t, "2026-10-12", edited["deadline"])
	assert.EqualValues(t, sh.jarayonda, edited["stage_id"])
	assert.Equal(t, map[string]any{"phone": valisPhone, "full_name": "Vali Aliyev"}, edited["assignee"])
	assert.Equal(t, map[string]any{key(sh.izoh): "Kechqurun"}, edited["values"], "an answer left out is taken away")
	assert.Equal(t, task["customer"], edited["customer"], "the customer stays")
	assert.Equal(t, task["type_id"], edited["type_id"], "the type stays")
	assert.Equal(t, task["created_at"], edited["created_at"])
	assert.NotEqual(t, task["updated_at"], edited["updated_at"], "the moment of the edit")
	rec = api.do(t, http.MethodGet, path, "", bearer(owner))
	require.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, edited, decode(t, rec))

	rec = api.do(t, http.MethodPut, path, fmt.Sprintf(`{"title":"","deadline":"2026-10-12","stage_id":%d,"values":{"%d":"X"}}`, sh.jarayonda, sh.izoh), bearer(owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Vazifa nomini kiriting"}`, rec.Body.String())
	rec = api.do(t, http.MethodPut, path, fmt.Sprintf(`{"title":"X","deadline":"2026-10-12","stage_id":%d,"values":{}}`, sh.jarayonda), bearer(owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"«Izoh» maydonini to'ldiring"}`, rec.Body.String())
	assert.Equal(t, http.StatusBadRequest, api.do(t, http.MethodPut, path, `{"title":`, bearer(owner)).Code, "not JSON")
	rec = api.do(t, http.MethodPut, path, body, bearer(stranger))
	assert.Equal(t, http.StatusNotFound, rec.Code, "another company's task")
	assert.JSONEq(t, taskNotFound, rec.Body.String())
	assert.Equal(t, http.StatusNotFound, api.do(t, http.MethodPut, "/app/tasks/abc", body, bearer(owner)).Code, "an id that is no number")
	assert.Equal(t, http.StatusUnauthorized, api.do(t, http.MethodPut, path, body).Code, "no access token")
}

func TestMoveTask(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	stranger, _ := api.signIn(t, "998907777777", map[int64]string{nok: "user"})
	sh := api.taskShop(t, olma)
	begona := api.addStage(t, nok, "Begona", "red", false, 1)
	ali := api.enter(t, owner, sh.jismoniy, "998901112233", fmt.Sprintf(`{"%d":"Ali Valiyev"}`, sh.fish))
	task := api.enterTask(t, owner, taskBody(sh, "Qo'ng'iroq", "2026-10-10", sh.yangi, ali["id"], fmt.Sprintf(`{"%d":"Ertalab"}`, sh.izoh), ""))
	path := fmt.Sprintf("/app/tasks/%v/stage", task["id"])

	rec := api.do(t, http.MethodPatch, path, fmt.Sprintf(`{"stage_id":%d}`, sh.bajarildi), bearer(employee))

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	moved := decode(t, rec)
	assert.EqualValues(t, sh.bajarildi, moved["stage_id"], "any member moves a task to another stage")
	assert.Equal(t, task["title"], moved["title"], "nothing else changes")
	assert.Equal(t, task["values"], moved["values"])
	rec = api.do(t, http.MethodGet, fmt.Sprintf("/app/tasks/%v", task["id"]), "", bearer(owner))
	require.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, moved, decode(t, rec))

	for _, body := range []string{`{"stage_id":0}`, `{}`, fmt.Sprintf(`{"stage_id":%d}`, begona)} {
		rec = api.do(t, http.MethodPatch, path, body, bearer(owner))
		assert.Equal(t, http.StatusBadRequest, rec.Code, body)
		assert.JSONEq(t, `{"error":"validation_error","message":"Bosqichni tanlang"}`, rec.Body.String(), body)
	}
	assert.Equal(t, http.StatusBadRequest, api.do(t, http.MethodPatch, path, `{"stage_id":`, bearer(owner)).Code, "not JSON")
	rec = api.do(t, http.MethodPatch, path, fmt.Sprintf(`{"stage_id":%d}`, begona), bearer(stranger))
	assert.Equal(t, http.StatusNotFound, rec.Code, "another company's task")
	assert.JSONEq(t, taskNotFound, rec.Body.String())
	assert.Equal(t, http.StatusUnauthorized, api.do(t, http.MethodPatch, path, `{}`).Code, "no access token")
}

func TestDeleteTask(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	stranger, _ := api.signIn(t, "998907777777", map[int64]string{nok: "user"})
	sh := api.taskShop(t, olma)
	ali := api.enter(t, owner, sh.jismoniy, "998901112233", fmt.Sprintf(`{"%d":"Ali Valiyev"}`, sh.fish))
	task := api.enterTask(t, owner, taskBody(sh, "Qo'ng'iroq", "2026-10-10", sh.yangi, ali["id"], fmt.Sprintf(`{"%d":"Ertalab"}`, sh.izoh), ""))
	path := fmt.Sprintf("/app/tasks/%v", task["id"])
	customer := fmt.Sprintf("/app/customers/%v", ali["id"])

	rec := api.do(t, http.MethodDelete, customer, "", bearer(owner))
	assert.Equal(t, http.StatusConflict, rec.Code, "a customer with a task is not deleted")
	assert.JSONEq(t, `{"error":"customer_in_use","message":"Bu mijozda 1 ta vazifa bor"}`, rec.Body.String())
	rec = api.do(t, http.MethodDelete, path, "", bearer(stranger))
	assert.Equal(t, http.StatusNotFound, rec.Code, "another company's task")
	assert.JSONEq(t, taskNotFound, rec.Body.String())

	rec = api.do(t, http.MethodDelete, path, "", bearer(employee))

	assert.Equal(t, http.StatusNoContent, rec.Code, "any member deletes a task: %s", rec.Body.String())
	assert.Equal(t, http.StatusNotFound, api.do(t, http.MethodGet, path, "", bearer(owner)).Code, "the task is gone")
	assert.Equal(t, http.StatusNotFound, api.do(t, http.MethodDelete, path, "", bearer(owner)).Code, "deleted already")
	assert.Equal(t, []any{}, decode(t, api.do(t, http.MethodGet, "/app/tasks", "", bearer(owner)))["items"], "and out of the list")
	assert.Equal(t, http.StatusNoContent, api.do(t, http.MethodDelete, customer, "", bearer(owner)).Code, "once its tasks are deleted, the customer goes")
	assert.Equal(t, http.StatusNotFound, api.do(t, http.MethodDelete, "/app/tasks/abc", "", bearer(owner)).Code, "an id that is no number")
	assert.Equal(t, http.StatusUnauthorized, api.do(t, http.MethodDelete, path, "").Code, "no access token")
}

func TestTaskHistory(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	undecided, _ := api.signIn(t, sardorsPhone, map[int64]string{olma: "user", nok: "user"})
	stranger, _ := api.signIn(t, "998907777777", map[int64]string{nok: "owner"})
	api.exec(t, "UPDATE user_companies SET full_name = 'Ali Egasi' WHERE user_phone = $1", alisPhone)
	api.exec(t, "UPDATE user_companies SET full_name = 'Vali Xodim' WHERE user_phone = $1", valisPhone)
	sh := api.taskShop(t, olma)
	ali := api.enter(t, owner, sh.jismoniy, "998901112233", fmt.Sprintf(`{"%d":"Ali Valiyev"}`, sh.fish))
	task := api.enterTask(t, employee, taskBody(sh, "Qo'ng'iroq", "2026-10-10", sh.yangi, ali["id"], fmt.Sprintf(`{"%d":"Ertalab"}`, sh.izoh), ""))
	rec := api.do(t, http.MethodPut, fmt.Sprintf("/app/tasks/%v", task["id"]),
		fmt.Sprintf(`{"title":"Qo'ng'iroq","deadline":"2026-10-12","stage_id":%d,"assignee_phone":%q,"values":{"%d":"Kechqurun"}}`, sh.jarayonda, valisPhone, sh.izoh), bearer(owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	path := fmt.Sprintf("/app/tasks/%v/history", task["id"])

	rec = api.do(t, http.MethodGet, path, "", bearer(owner))

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	history := list(t, rec)
	require.Len(t, history, 2)
	edited, entered := history[0], history[1]
	assert.Equal(t, "updated", edited["action"], "the latest first")
	assert.Equal(t, "Ali Egasi", edited["actor_name"])
	assert.Equal(t, []any{
		map[string]any{"label": "Muddat", "old": "10.10.2026", "new": "12.10.2026"},
		map[string]any{"label": "Bosqich", "old": "Yangi", "new": "Jarayonda"},
		map[string]any{"label": "Mas'ul", "old": "", "new": "Vali Xodim"},
		map[string]any{"label": "Izoh", "old": "Ertalab", "new": "Kechqurun"},
	}, edited["changes"], "what the edit changed: the task's own fields, then the type's")
	assert.NotEmpty(t, edited["id"])
	assert.NotEmpty(t, edited["created_at"])
	assert.Equal(t, "created", entered["action"])
	assert.Equal(t, "Vali Xodim", entered["actor_name"])
	assert.Equal(t, []any{}, entered["changes"])

	rec = api.do(t, http.MethodGet, path, "", bearer(employee))
	assert.Equal(t, http.StatusForbidden, rec.Code, "the history is for the owner")
	assert.JSONEq(t, noPermission, rec.Body.String())
	rec = api.do(t, http.MethodGet, path, "", bearer(stranger))
	assert.Equal(t, http.StatusNotFound, rec.Code, "the owner of another company")
	assert.JSONEq(t, taskNotFound, rec.Body.String())
	assert.Equal(t, http.StatusNotFound, api.do(t, http.MethodGet, "/app/tasks/abc/history", "", bearer(owner)).Code, "an id that is no number")
	rec = api.do(t, http.MethodGet, path, "", bearer(undecided))
	assert.Equal(t, http.StatusForbidden, rec.Code, "a session that has not chosen a company yet")
	assert.JSONEq(t, companyRequired, rec.Body.String())
	assert.Equal(t, http.StatusUnauthorized, api.do(t, http.MethodGet, path, "").Code, "no access token")
	require.Equal(t, http.StatusNoContent, api.do(t, http.MethodDelete, fmt.Sprintf("/app/tasks/%v", task["id"]), "", bearer(owner)).Code)
	assert.Equal(t, http.StatusNotFound, api.do(t, http.MethodGet, path, "", bearer(owner)).Code, "a deleted task's history is kept, not shown")
}
