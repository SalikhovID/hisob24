package app

import (
	"fmt"
	"net/http"
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
