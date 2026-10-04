package app

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// customerShop is what a company is set up with for customers: the type
// Jismoniy with a name that is required, an age, a passport that may not
// repeat, and a source to choose of Instagram and LinkedIn.
type customerShop struct {
	jismoniy                   int64
	fish, yosh, pasport, manba int64
	instagram, linkedin        int64
}

func (api testAPI) customerShop(t *testing.T, companyID int64) customerShop {
	t.Helper()
	var sh customerShop
	dropdown := api.id(t, "INSERT INTO customer_dropdowns (company_id, name) VALUES ($1, 'Manba') RETURNING id", companyID)
	sh.instagram = api.id(t, "INSERT INTO customer_dropdown_options (dropdown_id, label, position) VALUES ($1, 'Instagram', 1) RETURNING id", dropdown)
	sh.linkedin = api.id(t, "INSERT INTO customer_dropdown_options (dropdown_id, label, position) VALUES ($1, 'LinkedIn', 2) RETURNING id", dropdown)
	sh.jismoniy = api.id(t, "INSERT INTO customer_types (company_id, name, position) VALUES ($1, 'Jismoniy', 1) RETURNING id", companyID)
	field := func(label, kind string, required, unique bool, dropdownID *int64, position int) int64 {
		return api.id(t, `INSERT INTO customer_fields (company_id, type_id, label, kind, required, is_unique, dropdown_id, position)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`, companyID, sh.jismoniy, label, kind, required, unique, dropdownID, position)
	}
	sh.fish = field("F.I.Sh.", "string", true, false, nil, 1)
	sh.yosh = field("Yoshi", "int", false, false, nil, 2)
	sh.pasport = field("Pasport", "string", false, true, nil, 3)
	sh.manba = field("Manba", "dropdown", false, false, &dropdown, 4)
	return sh
}

// key is a field's id as the key of a customer's values.
func key(fieldID int64) string { return fmt.Sprint(fieldID) }

func TestCreateCustomer(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	undecided, _ := api.signIn(t, sardorsPhone, map[int64]string{olma: "user", nok: "owner"})
	api.exec(t, "UPDATE user_companies SET full_name = 'Vali Aliyev' WHERE user_phone = $1", valisPhone)
	sh := api.customerShop(t, olma)

	rec := api.do(t, http.MethodPost, "/app/customers", fmt.Sprintf(
		`{"type_id":%d,"phone":"+998 90 111 22 33","values":{"%d":" Ali Valiyev ","%d":30,"%d":"AA1234567","%d":%d}}`,
		sh.jismoniy, sh.fish, sh.yosh, sh.pasport, sh.manba, sh.instagram), bearer(employee))

	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	ali := decode(t, rec)
	assert.NotEmpty(t, ali["id"])
	assert.EqualValues(t, sh.jismoniy, ali["type_id"])
	assert.Equal(t, "998901112233", ali["phone"])
	assert.Equal(t, map[string]any{
		key(sh.fish): "Ali Valiyev", key(sh.yosh): float64(30), key(sh.pasport): "AA1234567", key(sh.manba): float64(sh.instagram),
	}, ali["values"], "an employee enters a customer with its answers, by the id of the field")
	assert.Equal(t, "Vali Aliyev", ali["created_by_name"], "under the name they go by in the company")
	assert.NotEmpty(t, ali["created_at"])
	assert.Equal(t, ali["created_at"], ali["updated_at"])

	rec = api.do(t, http.MethodPost, "/app/customers",
		fmt.Sprintf(`{"type_id":%d,"phone":"901112244","values":{"%d":"Vali"}}`, sh.jismoniy, sh.fish), bearer(owner))
	require.Equal(t, http.StatusCreated, rec.Code, "the owner enters customers too: %s", rec.Body.String())
	assert.Nil(t, decode(t, rec)["created_by_name"], "a member who goes by no name")

	rec = api.do(t, http.MethodPost, "/app/customers",
		fmt.Sprintf(`{"type_id":%d,"phone":"998901112233","values":{"%d":"Soli"}}`, sh.jismoniy, sh.fish), bearer(owner))
	assert.Equal(t, http.StatusConflict, rec.Code)
	assert.JSONEq(t, fmt.Sprintf(`{"error":"phone_taken","message":"Bu raqamli mijoz allaqachon bor","customer_id":%v}`, ali["id"]),
		rec.Body.String(), "the refusal names the customer who has the phone")
	rec = api.do(t, http.MethodPost, "/app/customers",
		fmt.Sprintf(`{"type_id":%d,"phone":"998901112255","values":{"%d":"Soli","%d":"aa1234567"}}`, sh.jismoniy, sh.fish, sh.pasport), bearer(owner))
	assert.Equal(t, http.StatusConflict, rec.Code)
	assert.JSONEq(t, fmt.Sprintf(`{"error":"value_taken","message":"Bu «Pasport» boshqa mijozda bor","customer_id":%v}`, ali["id"]),
		rec.Body.String(), "or the answer that may not repeat")

	rec = api.do(t, http.MethodPost, "/app/customers", fmt.Sprintf(`{"type_id":%d,"phone":"998901112266"}`, sh.jismoniy), bearer(owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"«F.I.Sh.» maydonini to'ldiring"}`, rec.Body.String())
	rec = api.do(t, http.MethodPost, "/app/customers", `{"phone":"998901112266"}`, bearer(owner))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Mijoz turini tanlang"}`, rec.Body.String())
	assert.Equal(t, http.StatusBadRequest, api.do(t, http.MethodPost, "/app/customers", `{"type_id":`, bearer(owner)).Code, "not JSON")
	assert.Equal(t, http.StatusBadRequest, api.do(t, http.MethodPost, "/app/customers",
		fmt.Sprintf(`{"type_id":%d,"phone":"998901112266","values":["Ali"]}`, sh.jismoniy), bearer(owner)).Code, "values that are no object")

	rec = api.do(t, http.MethodPost, "/app/customers", `{}`, bearer(undecided))
	assert.Equal(t, http.StatusForbidden, rec.Code, "a session that has not chosen a company yet")
	assert.JSONEq(t, companyRequired, rec.Body.String())
	assert.Equal(t, http.StatusUnauthorized, api.do(t, http.MethodPost, "/app/customers", `{}`).Code, "no access token")
}

const customerNotFound = `{"error":"not_found","message":"Mijoz topilmadi"}`

// enter enters a customer through the API, as the member the token is of,
// and returns it as the API answers.
func (api testAPI) enter(t *testing.T, token string, typeID int64, phone string, values string) map[string]any {
	t.Helper()
	rec := api.do(t, http.MethodPost, "/app/customers",
		fmt.Sprintf(`{"type_id":%d,"phone":%q,"values":%s}`, typeID, phone, values), bearer(token))
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	return decode(t, rec)
}

func TestGetCustomer(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	undecided, _ := api.signIn(t, sardorsPhone, map[int64]string{olma: "user", nok: "owner"})
	stranger, _ := api.signIn(t, "998907777777", map[int64]string{nok: "user"})
	sh := api.customerShop(t, olma)
	ali := api.enter(t, owner, sh.jismoniy, "998901112233", fmt.Sprintf(`{"%d":"Ali Valiyev","%d":%d}`, sh.fish, sh.manba, sh.linkedin))
	path := fmt.Sprintf("/app/customers/%v", ali["id"])

	rec := api.do(t, http.MethodGet, path, "", bearer(employee))

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, ali, decode(t, rec), "any member reads the customer as it was entered")

	rec = api.do(t, http.MethodGet, path, "", bearer(stranger))
	assert.Equal(t, http.StatusNotFound, rec.Code, "another company's customer")
	assert.JSONEq(t, customerNotFound, rec.Body.String())
	assert.Equal(t, http.StatusNotFound, api.do(t, http.MethodGet, "/app/customers/999999", "", bearer(owner)).Code, "a customer that is not there")
	rec = api.do(t, http.MethodGet, "/app/customers/abc", "", bearer(owner))
	assert.Equal(t, http.StatusNotFound, rec.Code, "an id that is no number")
	assert.JSONEq(t, customerNotFound, rec.Body.String())
	rec = api.do(t, http.MethodGet, path, "", bearer(undecided))
	assert.Equal(t, http.StatusForbidden, rec.Code, "a session that has not chosen a company yet")
	assert.JSONEq(t, companyRequired, rec.Body.String())
	assert.Equal(t, http.StatusUnauthorized, api.do(t, http.MethodGet, path, "").Code, "no access token")
	api.exec(t, "UPDATE customers SET deleted_at = now() WHERE id = $1", ali["id"])
	assert.Equal(t, http.StatusNotFound, api.do(t, http.MethodGet, path, "", bearer(owner)).Code, "a deleted customer")
}

func TestListCustomers(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	undecided, _ := api.signIn(t, sardorsPhone, map[int64]string{olma: "user", nok: "owner"})
	stranger, _ := api.signIn(t, "998907777777", map[int64]string{nok: "user"})
	sh := api.customerShop(t, olma)
	yuridik := api.id(t, "INSERT INTO customer_types (company_id, name, position) VALUES ($1, 'Yuridik', 2) RETURNING id", olma)
	ali := api.enter(t, owner, sh.jismoniy, "998901112233", fmt.Sprintf(`{"%d":"Ali Valiyev"}`, sh.fish))
	vali := api.enter(t, employee, sh.jismoniy, "998901112244", fmt.Sprintf(`{"%d":"Vali Aliyev","%d":45}`, sh.fish, sh.yosh))
	firma := api.enter(t, owner, yuridik, "998901112255", `{}`)
	begona := api.customerShop(t, nok)
	api.enter(t, stranger, begona.jismoniy, "998901112233", fmt.Sprintf(`{"%d":"Ali Begona"}`, begona.fish))
	// get reads a page of Olma's customers as its employee.
	get := func(query url.Values) map[string]any {
		t.Helper()
		rec := api.do(t, http.MethodGet, "/app/customers?"+query.Encode(), "", bearer(employee))
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
		return decode(t, rec)
	}

	page := get(nil)

	assert.Equal(t, []any{firma, vali, ali}, page["items"], "the company's customers, the newest first, each as it is read alone")
	assert.EqualValues(t, 3, page["total"])
	assert.EqualValues(t, 1, page["page"])
	assert.EqualValues(t, 20, page["page_size"])

	assert.Equal(t, []any{vali, ali}, get(url.Values{"search": {"ALI"}})["items"], "a search in the text answers")
	assert.Equal(t, []any{vali}, get(url.Values{"search": {"+998 90 111 22 44"}})["items"], "in the phones")
	assert.Equal(t, []any{vali}, get(url.Values{"search": {"45"}, "type_id": {fmt.Sprint(sh.jismoniy)}})["items"], "in the numbers, within a type")
	found := get(url.Values{"type_id": {fmt.Sprint(yuridik)}})
	assert.Equal(t, []any{firma}, found["items"], "one type")
	assert.EqualValues(t, 1, found["total"])
	past := get(url.Values{"page": {"2"}})
	assert.Equal(t, []any{}, past["items"], "a page past the last")
	assert.EqualValues(t, 3, past["total"])
	assert.EqualValues(t, 2, past["page"])

	for query, message := range map[string]string{
		"page=abc":    "Sahifa raqami noto'g'ri",
		"page=0":      "Sahifa raqami noto'g'ri",
		"type_id=abc": "Mijoz turi noto'g'ri",
		"type_id=0":   "Mijoz turi noto'g'ri",
	} {
		rec := api.do(t, http.MethodGet, "/app/customers?"+query, "", bearer(owner))
		assert.Equal(t, http.StatusBadRequest, rec.Code, query)
		assert.JSONEq(t, fmt.Sprintf(`{"error":"validation_error","message":%q}`, message), rec.Body.String(), query)
	}
	rec := api.do(t, http.MethodGet, "/app/customers", "", bearer(undecided))
	assert.Equal(t, http.StatusForbidden, rec.Code, "a session that has not chosen a company yet")
	assert.JSONEq(t, companyRequired, rec.Body.String())
	assert.Equal(t, http.StatusUnauthorized, api.do(t, http.MethodGet, "/app/customers", "").Code, "no access token")
}

func TestUpdateCustomer(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	undecided, _ := api.signIn(t, sardorsPhone, map[int64]string{olma: "user", nok: "owner"})
	stranger, _ := api.signIn(t, "998907777777", map[int64]string{nok: "user"})
	sh := api.customerShop(t, olma)
	ali := api.enter(t, owner, sh.jismoniy, "998901112233", fmt.Sprintf(`{"%d":"Ali","%d":"AA1234567"}`, sh.fish, sh.pasport))
	vali := api.enter(t, owner, sh.jismoniy, "998901112244", fmt.Sprintf(`{"%d":"Vali","%d":"AB7654321"}`, sh.fish, sh.pasport))
	path := fmt.Sprintf("/app/customers/%v", ali["id"])
	// put edits Ali as the member the token is of.
	put := func(token, phone, values string) *httptest.ResponseRecorder {
		return api.do(t, http.MethodPut, path, fmt.Sprintf(`{"phone":%q,"values":%s}`, phone, values), bearer(token))
	}

	rec := put(employee, "+998 90 111 22 55", fmt.Sprintf(`{"%d":" Ali Valiyev ","%d":31}`, sh.fish, sh.yosh))

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	edited := decode(t, rec)
	assert.Equal(t, ali["id"], edited["id"])
	assert.Equal(t, ali["type_id"], edited["type_id"])
	assert.Equal(t, "998901112255", edited["phone"])
	assert.Equal(t, map[string]any{key(sh.fish): "Ali Valiyev", key(sh.yosh): float64(31)}, edited["values"],
		"an employee edits the customer: the answers are those of the edit")
	assert.Equal(t, ali["created_at"], edited["created_at"])
	rec = api.do(t, http.MethodGet, path, "", bearer(owner))
	require.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, edited, decode(t, rec), "what the edit answers is what is kept")

	name := fmt.Sprintf(`{"%d":"Ali Valiyev"}`, sh.fish)
	rec = put(owner, "998901112244", name)
	assert.Equal(t, http.StatusConflict, rec.Code)
	assert.JSONEq(t, fmt.Sprintf(`{"error":"phone_taken","message":"Bu raqamli mijoz allaqachon bor","customer_id":%v}`, vali["id"]), rec.Body.String())
	rec = put(owner, "998901112255", fmt.Sprintf(`{"%d":"Ali Valiyev","%d":"ab7654321"}`, sh.fish, sh.pasport))
	assert.Equal(t, http.StatusConflict, rec.Code)
	assert.JSONEq(t, fmt.Sprintf(`{"error":"value_taken","message":"Bu «Pasport» boshqa mijozda bor","customer_id":%v}`, vali["id"]), rec.Body.String())
	rec = put(owner, "123", name)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"validation_error","message":"Telefon raqami noto'g'ri"}`, rec.Body.String())
	assert.Equal(t, http.StatusBadRequest, api.do(t, http.MethodPut, path, `{"phone":`, bearer(owner)).Code, "not JSON")

	rec = put(stranger, "998901112255", name)
	assert.Equal(t, http.StatusNotFound, rec.Code, "another company's customer")
	assert.JSONEq(t, customerNotFound, rec.Body.String())
	assert.Equal(t, http.StatusNotFound,
		api.do(t, http.MethodPut, "/app/customers/abc", `{"phone":"998901112255","values":{}}`, bearer(owner)).Code, "an id that is no number")
	rec = put(undecided, "998901112255", name)
	assert.Equal(t, http.StatusForbidden, rec.Code, "a session that has not chosen a company yet")
	assert.JSONEq(t, companyRequired, rec.Body.String())
	assert.Equal(t, http.StatusUnauthorized, api.do(t, http.MethodPut, path, `{}`).Code, "no access token")
}
