package app

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// addStage inserts a stage of the company at a place and returns its id.
func (api testAPI) addStage(t *testing.T, companyID int64, name, color string, done bool, position int) int64 {
	t.Helper()
	return api.id(t, "INSERT INTO task_stages (company_id, name, color, is_done, position) VALUES ($1, $2, $3, $4, $5) RETURNING id",
		companyID, name, color, done, position)
}

// addTaskType inserts a task type of the company at a place and returns its id.
func (api testAPI) addTaskType(t *testing.T, companyID int64, name string, position int) int64 {
	t.Helper()
	return api.id(t, "INSERT INTO task_types (company_id, name, position) VALUES ($1, $2, $3) RETURNING id", companyID, name, position)
}

const stageNotFound = `{"error":"not_found","message":"Bosqich topilmadi"}`

func TestListTaskStages(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	undecided, _ := api.signIn(t, sardorsPhone, map[int64]string{olma: "user", nok: "owner"})
	yangi := api.addStage(t, olma, "Yangi", "blue", false, 2)
	bajarildi := api.addStage(t, olma, "Bajarildi", "green", true, 1)
	api.addStage(t, nok, "Begona", "red", false, 1)

	rec := api.do(t, http.MethodGet, "/app/task-stages", "", bearer(employee))

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.JSONEq(t, fmt.Sprintf(`[{"id":%d,"name":"Bajarildi","color":"green","is_done":true},{"id":%d,"name":"Yangi","color":"blue","is_done":false}]`,
		bajarildi, yangi), rec.Body.String(), "an employee reads the stages of the company they work in, in their order, nobody else's")
	assert.Equal(t, http.StatusOK, api.do(t, http.MethodGet, "/app/task-stages", "", bearer(owner)).Code, "the owner")

	rec = api.do(t, http.MethodGet, "/app/task-stages", "", bearer(undecided))
	assert.Equal(t, http.StatusForbidden, rec.Code, "a session that has not chosen a company yet")
	assert.JSONEq(t, companyRequired, rec.Body.String())
	assert.Equal(t, http.StatusUnauthorized, api.do(t, http.MethodGet, "/app/task-stages", "").Code, "no access token")
	api.exec(t, "UPDATE companies SET end_date = CURRENT_DATE - 1 WHERE id = $1", olma)
	assert.Equal(t, http.StatusPaymentRequired, api.do(t, http.MethodGet, "/app/task-stages", "", bearer(owner)).Code, "an expired company")
}

func TestCreateTaskStage(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})

	rec := api.do(t, http.MethodPost, "/app/task-stages", `{"name":" Kutilmoqda ","color":"amber"}`, bearer(owner))

	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	created := decode(t, rec)
	assert.Equal(t, "Kutilmoqda", created["name"])
	assert.Equal(t, "amber", created["color"])
	assert.Equal(t, false, created["is_done"], "a stage holds unfinished tasks unless said otherwise")
	assert.NotEmpty(t, created["id"])
	rec = api.do(t, http.MethodPost, "/app/task-stages", `{"name":"Bajarildi","color":"green","is_done":true}`, bearer(owner))
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	assert.Equal(t, true, decode(t, rec)["is_done"])
	assert.Len(t, list(t, api.do(t, http.MethodGet, "/app/task-stages", "", bearer(owner))), 2, "they join the company's stages")

	rec = api.do(t, http.MethodPost, "/app/task-stages", `{"name":"kutilmoqda","color":"red"}`, bearer(owner))
	assert.Equal(t, http.StatusConflict, rec.Code)
	assert.JSONEq(t, `{"error":"name_taken","message":"Bu nomli bosqich allaqachon bor"}`, rec.Body.String())
	rec = api.do(t, http.MethodPost, "/app/task-stages", `{"name":"Oltin","color":"gold"}`, bearer(owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Rangni tanlang"}`, rec.Body.String())
	rec = api.do(t, http.MethodPost, "/app/task-stages", `{"name":" ","color":"blue"}`, bearer(owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Nomni kiriting"}`, rec.Body.String())
	rec = api.do(t, http.MethodPost, "/app/task-stages", `{"name":"Yangi","color":"blue"}`, bearer(employee))
	assert.Equal(t, http.StatusForbidden, rec.Code, "an employee sets nothing up")
	assert.JSONEq(t, ownerOnly, rec.Body.String())
}

func TestUpdateTaskStage(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	yangi := api.addStage(t, olma, "Yangi", "blue", false, 1)
	begona := api.addStage(t, nok, "Begona", "red", false, 1)
	path := fmt.Sprintf("/app/task-stages/%d", yangi)

	rec := api.do(t, http.MethodPatch, path, `{"name":" Ochiq "}`, bearer(owner))

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.JSONEq(t, fmt.Sprintf(`{"id":%d,"name":"Ochiq","color":"blue","is_done":false}`, yangi), rec.Body.String(), "what the body leaves out stays")
	rec = api.do(t, http.MethodPatch, path, `{"color":"teal","is_done":true}`, bearer(owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.JSONEq(t, fmt.Sprintf(`{"id":%d,"name":"Ochiq","color":"teal","is_done":true}`, yangi), rec.Body.String())

	rec = api.do(t, http.MethodPatch, path, `{"color":"gold"}`, bearer(owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Rangni tanlang"}`, rec.Body.String())
	rec = api.do(t, http.MethodPatch, fmt.Sprintf("/app/task-stages/%d", begona), `{"name":"Meniki"}`, bearer(owner))
	assert.Equal(t, http.StatusNotFound, rec.Code, "another company's stage")
	assert.JSONEq(t, stageNotFound, rec.Body.String())
	rec = api.do(t, http.MethodPatch, path, `{"name":"Yopiq"}`, bearer(employee))
	assert.Equal(t, http.StatusForbidden, rec.Code, "an employee sets nothing up")
	assert.JSONEq(t, ownerOnly, rec.Body.String())
}

func TestDeleteTaskStage(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	yangi := api.addStage(t, olma, "Yangi", "blue", false, 1)
	api.addStage(t, olma, "Jarayonda", "amber", false, 2)
	path := fmt.Sprintf("/app/task-stages/%d", yangi)

	rec := api.do(t, http.MethodDelete, path, "", bearer(employee))
	assert.Equal(t, http.StatusForbidden, rec.Code, "an employee sets nothing up")
	rec = api.do(t, http.MethodDelete, path, "", bearer(owner))

	require.Equal(t, http.StatusNoContent, rec.Code, rec.Body.String())
	stages := list(t, api.do(t, http.MethodGet, "/app/task-stages", "", bearer(owner)))
	require.Len(t, stages, 1, "the stage is gone from the company's")
	assert.Equal(t, "Jarayonda", stages[0]["name"])
	rec = api.do(t, http.MethodDelete, path, "", bearer(owner))
	assert.Equal(t, http.StatusNotFound, rec.Code, "deleted already")
	assert.JSONEq(t, stageNotFound, rec.Body.String())
}

func TestOrderTaskStages(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	yangi := api.addStage(t, olma, "Yangi", "blue", false, 1)
	bajarildi := api.addStage(t, olma, "Bajarildi", "green", true, 2)

	rec := api.do(t, http.MethodPut, "/app/task-stages/order", fmt.Sprintf(`{"ids":[%d,%d]}`, bajarildi, yangi), bearer(owner))

	require.Equal(t, http.StatusNoContent, rec.Code, rec.Body.String())
	stages := list(t, api.do(t, http.MethodGet, "/app/task-stages", "", bearer(owner)))
	require.Len(t, stages, 2)
	assert.Equal(t, "Bajarildi", stages[0]["name"], "the stages stand in the new order")

	rec = api.do(t, http.MethodPut, "/app/task-stages/order", fmt.Sprintf(`{"ids":[%d]}`, yangi), bearer(owner))
	assert.Equal(t, http.StatusConflict, rec.Code, "a stage is missing")
	assert.JSONEq(t, orderChanged, rec.Body.String())
	rec = api.do(t, http.MethodPut, "/app/task-stages/order", fmt.Sprintf(`{"ids":[%d,%d]}`, yangi, bajarildi), bearer(employee))
	assert.Equal(t, http.StatusForbidden, rec.Code, "an employee sets nothing up")
	assert.JSONEq(t, ownerOnly, rec.Body.String())
}

func TestListTaskTypes(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	undecided, _ := api.signIn(t, sardorsPhone, map[int64]string{olma: "user", nok: "owner"})
	manba := api.id(t, "INSERT INTO customer_dropdowns (company_id, name) VALUES ($1, 'Manba') RETURNING id", olma)
	buyurtma := api.addTaskType(t, olma, "Buyurtma", 1)
	summa := api.id(t, `INSERT INTO task_fields (company_id, type_id, label, kind, required, position)
		VALUES ($1, $2, 'Summa', 'int', true, 1) RETURNING id`, olma, buyurtma)
	source := api.id(t, `INSERT INTO task_fields (company_id, type_id, label, kind, dropdown_id, position)
		VALUES ($1, $2, 'Manba', 'dropdown', $3, 2) RETURNING id`, olma, buyurtma, manba)
	api.addTaskType(t, nok, "Begona", 1)

	rec := api.do(t, http.MethodGet, "/app/task-types", "", bearer(employee))

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.JSONEq(t, fmt.Sprintf(`[{"id":%d,"name":"Buyurtma","fields":[
			{"id":%d,"label":"Summa","kind":"int","required":true,"dropdown_id":null},
			{"id":%d,"label":"Manba","kind":"dropdown","required":false,"dropdown_id":%d}]}]`,
		buyurtma, summa, source, manba), rec.Body.String(), "an employee reads the types of the company they work in, with their fields")
	assert.NotContains(t, rec.Body.String(), "is_unique", "a task field is never told not to repeat")
	assert.Equal(t, http.StatusOK, api.do(t, http.MethodGet, "/app/task-types", "", bearer(owner)).Code, "the owner")

	rec = api.do(t, http.MethodGet, "/app/task-types", "", bearer(undecided))
	assert.Equal(t, http.StatusForbidden, rec.Code, "a session that has not chosen a company yet")
	assert.JSONEq(t, companyRequired, rec.Body.String())
	assert.Equal(t, http.StatusUnauthorized, api.do(t, http.MethodGet, "/app/task-types", "").Code, "no access token")
}

func TestCreateTaskType(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})

	rec := api.do(t, http.MethodPost, "/app/task-types", `{"name":" Buyurtma "}`, bearer(owner))

	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	created := decode(t, rec)
	assert.Equal(t, "Buyurtma", created["name"])
	assert.Equal(t, []any{}, created["fields"])
	assert.NotEmpty(t, created["id"])
	assert.Len(t, list(t, api.do(t, http.MethodGet, "/app/task-types", "", bearer(owner))), 1, "it joins the company's types")

	rec = api.do(t, http.MethodPost, "/app/task-types", `{"name":"buyurtma"}`, bearer(owner))
	assert.Equal(t, http.StatusConflict, rec.Code)
	assert.JSONEq(t, `{"error":"name_taken","message":"Bu nomli tur allaqachon bor"}`, rec.Body.String())
	rec = api.do(t, http.MethodPost, "/app/task-types", `{"name":" "}`, bearer(owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Nomni kiriting"}`, rec.Body.String())
	rec = api.do(t, http.MethodPost, "/app/task-types", `{"name":"Shikoyat"}`, bearer(employee))
	assert.Equal(t, http.StatusForbidden, rec.Code, "an employee sets nothing up")
	assert.JSONEq(t, ownerOnly, rec.Body.String())
}

func TestOrderTaskTypes(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	buyurtma := api.addTaskType(t, olma, "Buyurtma", 1)
	shikoyat := api.addTaskType(t, olma, "Shikoyat", 2)

	rec := api.do(t, http.MethodPut, "/app/task-types/order", fmt.Sprintf(`{"ids":[%d,%d]}`, shikoyat, buyurtma), bearer(owner))

	require.Equal(t, http.StatusNoContent, rec.Code, rec.Body.String())
	types := list(t, api.do(t, http.MethodGet, "/app/task-types", "", bearer(owner)))
	require.Len(t, types, 2)
	assert.Equal(t, "Shikoyat", types[0]["name"], "the types stand in the new order")

	rec = api.do(t, http.MethodPut, "/app/task-types/order", fmt.Sprintf(`{"ids":[%d]}`, buyurtma), bearer(owner))
	assert.Equal(t, http.StatusConflict, rec.Code, "a type is missing")
	assert.JSONEq(t, orderChanged, rec.Body.String())
	rec = api.do(t, http.MethodPut, "/app/task-types/order", fmt.Sprintf(`{"ids":[%d,%d]}`, buyurtma, shikoyat), bearer(employee))
	assert.Equal(t, http.StatusForbidden, rec.Code, "an employee sets nothing up")
	assert.JSONEq(t, ownerOnly, rec.Body.String())
}

func TestRenameTaskType(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	buyurtma := api.addTaskType(t, olma, "Buyurtma", 1)
	begona := api.addTaskType(t, nok, "Begona", 1)

	rec := api.do(t, http.MethodPatch, fmt.Sprintf("/app/task-types/%d", buyurtma), `{"name":" Zakaz "}`, bearer(owner))

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.JSONEq(t, fmt.Sprintf(`{"id":%d,"name":"Zakaz","fields":[]}`, buyurtma), rec.Body.String())

	rec = api.do(t, http.MethodPatch, fmt.Sprintf("/app/task-types/%d", begona), `{"name":"Meniki"}`, bearer(owner))
	assert.Equal(t, http.StatusNotFound, rec.Code, "another company's type")
	assert.JSONEq(t, `{"error":"not_found","message":"Tur topilmadi"}`, rec.Body.String())
	rec = api.do(t, http.MethodPatch, fmt.Sprintf("/app/task-types/%d", buyurtma), `{"name":"Xodimniki"}`, bearer(employee))
	assert.Equal(t, http.StatusForbidden, rec.Code, "an employee sets nothing up")
	assert.JSONEq(t, ownerOnly, rec.Body.String())
}

func TestDeleteTaskType(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	buyurtma := api.addTaskType(t, olma, "Buyurtma", 1)
	api.addTaskType(t, olma, "Shikoyat", 2)
	api.exec(t, `INSERT INTO task_fields (company_id, type_id, label, kind, position) VALUES ($1, $2, 'Izoh', 'string', 1)`, olma, buyurtma)
	path := fmt.Sprintf("/app/task-types/%d", buyurtma)

	rec := api.do(t, http.MethodDelete, path, "", bearer(employee))
	assert.Equal(t, http.StatusForbidden, rec.Code, "an employee sets nothing up")
	rec = api.do(t, http.MethodDelete, path, "", bearer(owner))

	require.Equal(t, http.StatusNoContent, rec.Code, rec.Body.String())
	types := list(t, api.do(t, http.MethodGet, "/app/task-types", "", bearer(owner)))
	require.Len(t, types, 1, "the type is gone from the company's")
	assert.Equal(t, "Shikoyat", types[0]["name"])
	var live int
	require.NoError(t, api.pool.QueryRow(t.Context(), "SELECT count(*) FROM task_fields WHERE type_id = $1 AND deleted_at IS NULL", buyurtma).Scan(&live))
	assert.Zero(t, live, "its fields go with it")
	rec = api.do(t, http.MethodDelete, path, "", bearer(owner))
	assert.Equal(t, http.StatusNotFound, rec.Code, "deleted already")
	assert.JSONEq(t, `{"error":"not_found","message":"Tur topilmadi"}`, rec.Body.String())
}

func TestAddTaskField(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	manba := api.id(t, "INSERT INTO customer_dropdowns (company_id, name) VALUES ($1, 'Manba') RETURNING id", olma)
	buyurtma := api.addTaskType(t, olma, "Buyurtma", 1)
	begona := api.addTaskType(t, nok, "Begona", 1)
	path := fmt.Sprintf("/app/task-types/%d/fields", buyurtma)

	rec := api.do(t, http.MethodPost, path, `{"label":" Izoh ","kind":"string","required":true}`, bearer(owner))

	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	created := decode(t, rec)
	assert.Equal(t, "Izoh", created["label"])
	assert.Equal(t, "string", created["kind"])
	assert.Equal(t, true, created["required"])
	assert.Nil(t, created["dropdown_id"])
	assert.NotContains(t, created, "is_unique", "a task field is never told not to repeat")
	rec = api.do(t, http.MethodPost, path, fmt.Sprintf(`{"label":"Manba","kind":"radio","dropdown_id":%d}`, manba), bearer(owner))
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	assert.EqualValues(t, manba, decode(t, rec)["dropdown_id"], "a choice takes its options from the dropdown")
	types := list(t, api.do(t, http.MethodGet, "/app/task-types", "", bearer(owner)))
	assert.Len(t, types[0]["fields"], 2, "the fields join the type")

	for body, want := range map[string]string{
		`{"label":"Sana","kind":"date"}`:      `{"error":"validation_error","message":"Maydon turini tanlang"}`,
		`{"label":"Holat","kind":"dropdown"}`: `{"error":"validation_error","message":"Dropdownni tanlang"}`,
		`{"label":"izoh","kind":"int"}`:       `{"error":"name_taken","message":"Bu nomli maydon allaqachon bor"}`,
		`{"label":" ","kind":"string"}`:       `{"error":"validation_error","message":"Nomni kiriting"}`,
	} {
		rec = api.do(t, http.MethodPost, path, body, bearer(owner))
		assert.JSONEq(t, want, rec.Body.String(), body)
	}
	rec = api.do(t, http.MethodPost, fmt.Sprintf("/app/task-types/%d/fields", begona), `{"label":"Izoh","kind":"string"}`, bearer(owner))
	assert.Equal(t, http.StatusNotFound, rec.Code, "another company's type")
	assert.JSONEq(t, `{"error":"not_found","message":"Tur topilmadi"}`, rec.Body.String())
	rec = api.do(t, http.MethodPost, path, `{"label":"Summa","kind":"int"}`, bearer(employee))
	assert.Equal(t, http.StatusForbidden, rec.Code, "an employee sets nothing up")
	assert.JSONEq(t, ownerOnly, rec.Body.String())
}

func TestUpdateTaskField(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	buyurtma := api.addTaskType(t, olma, "Buyurtma", 1)
	shikoyat := api.addTaskType(t, olma, "Shikoyat", 2)
	izoh := api.id(t, `INSERT INTO task_fields (company_id, type_id, label, kind, position) VALUES ($1, $2, 'Izoh', 'string', 1) RETURNING id`, olma, buyurtma)
	path := fmt.Sprintf("/app/task-types/%d/fields/%d", buyurtma, izoh)

	rec := api.do(t, http.MethodPatch, path, `{"label":" Tavsif "}`, bearer(owner))

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.JSONEq(t, fmt.Sprintf(`{"id":%d,"label":"Tavsif","kind":"string","required":false,"dropdown_id":null}`, izoh), rec.Body.String(),
		"what the body leaves out stays")
	rec = api.do(t, http.MethodPatch, path, `{"required":true}`, bearer(owner))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, true, decode(t, rec)["required"])

	rec = api.do(t, http.MethodPatch, fmt.Sprintf("/app/task-types/%d/fields/%d", shikoyat, izoh), `{"label":"Sabab"}`, bearer(owner))
	assert.Equal(t, http.StatusNotFound, rec.Code, "a field of another type")
	assert.JSONEq(t, `{"error":"not_found","message":"Maydon topilmadi"}`, rec.Body.String())
	rec = api.do(t, http.MethodPatch, path, `{"label":"Xodimniki"}`, bearer(employee))
	assert.Equal(t, http.StatusForbidden, rec.Code, "an employee sets nothing up")
	assert.JSONEq(t, ownerOnly, rec.Body.String())
}

func TestDeleteTaskField(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	buyurtma := api.addTaskType(t, olma, "Buyurtma", 1)
	izoh := api.id(t, `INSERT INTO task_fields (company_id, type_id, label, kind, position) VALUES ($1, $2, 'Izoh', 'string', 1) RETURNING id`, olma, buyurtma)
	path := fmt.Sprintf("/app/task-types/%d/fields/%d", buyurtma, izoh)

	rec := api.do(t, http.MethodDelete, path, "", bearer(employee))
	assert.Equal(t, http.StatusForbidden, rec.Code, "an employee sets nothing up")
	rec = api.do(t, http.MethodDelete, path, "", bearer(owner))

	require.Equal(t, http.StatusNoContent, rec.Code, rec.Body.String())
	types := list(t, api.do(t, http.MethodGet, "/app/task-types", "", bearer(owner)))
	assert.Equal(t, []any{}, types[0]["fields"], "the field is gone from the type")
	rec = api.do(t, http.MethodDelete, path, "", bearer(owner))
	assert.Equal(t, http.StatusNotFound, rec.Code, "deleted already")
	assert.JSONEq(t, `{"error":"not_found","message":"Maydon topilmadi"}`, rec.Body.String())
}

func TestOrderTaskFields(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	buyurtma := api.addTaskType(t, olma, "Buyurtma", 1)
	izoh := api.id(t, `INSERT INTO task_fields (company_id, type_id, label, kind, position) VALUES ($1, $2, 'Izoh', 'string', 1) RETURNING id`, olma, buyurtma)
	summa := api.id(t, `INSERT INTO task_fields (company_id, type_id, label, kind, position) VALUES ($1, $2, 'Summa', 'int', 2) RETURNING id`, olma, buyurtma)
	path := fmt.Sprintf("/app/task-types/%d/fields/order", buyurtma)

	rec := api.do(t, http.MethodPut, path, fmt.Sprintf(`{"ids":[%d,%d]}`, summa, izoh), bearer(owner))

	require.Equal(t, http.StatusNoContent, rec.Code, rec.Body.String())
	types := list(t, api.do(t, http.MethodGet, "/app/task-types", "", bearer(owner)))
	fields, _ := types[0]["fields"].([]any)
	require.Len(t, fields, 2)
	first, _ := fields[0].(map[string]any)
	assert.Equal(t, "Summa", first["label"], "the fields stand in the new order")

	rec = api.do(t, http.MethodPut, path, fmt.Sprintf(`{"ids":[%d]}`, izoh), bearer(owner))
	assert.Equal(t, http.StatusConflict, rec.Code, "a field is missing")
	assert.JSONEq(t, orderChanged, rec.Body.String())
	rec = api.do(t, http.MethodPut, path, fmt.Sprintf(`{"ids":[%d,%d]}`, izoh, summa), bearer(employee))
	assert.Equal(t, http.StatusForbidden, rec.Code, "an employee sets nothing up")
	assert.JSONEq(t, ownerOnly, rec.Body.String())
}
