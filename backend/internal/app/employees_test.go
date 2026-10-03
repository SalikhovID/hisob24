package app

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// members decodes a list of members.
func members(t *testing.T, rec *httptest.ResponseRecorder) []map[string]any {
	t.Helper()
	var list []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &list), rec.Body.String())
	return list
}

const (
	valisPhone   = "998902223344"
	sardorsPhone = "998903334455"
)

func TestEmployeesAreForTheOwnerOnly(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	undecided, _ := api.signIn(t, sardorsPhone, map[int64]string{olma: "user", nok: "owner"})
	const ownerOnly = `{"error":"owner_only","message":"Bu bo'lim faqat kompaniya egasi uchun"}`

	rec := api.do(t, http.MethodGet, "/app/employees", "", bearer(employee))
	assert.Equal(t, http.StatusForbidden, rec.Code, "a user of the company")
	assert.JSONEq(t, ownerOnly, rec.Body.String())

	rec = api.do(t, http.MethodGet, "/app/employees", "", bearer(undecided))
	assert.Equal(t, http.StatusForbidden, rec.Code, "an owner who has not chosen the company yet")
	assert.JSONEq(t, ownerOnly, rec.Body.String())

	assert.Equal(t, http.StatusUnauthorized, api.do(t, http.MethodGet, "/app/employees", "").Code, "no access token")
	assert.Equal(t, http.StatusOK, api.do(t, http.MethodGet, "/app/employees", "", bearer(owner)).Code, "the owner")

	api.exec(t, "UPDATE companies SET end_date = CURRENT_DATE - 1 WHERE id = $1", olma)
	assert.Equal(t, http.StatusPaymentRequired, api.do(t, http.MethodGet, "/app/employees", "", bearer(owner)).Code,
		"the owner of an expired company")
}

func TestListEmployees(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	api.addUser(t, valisPhone)
	api.addMember(t, valisPhone, olma, "user")
	api.exec(t, "UPDATE user_companies SET full_name = 'Vali (hisobchi)' WHERE user_phone = $1", valisPhone)
	api.addUser(t, sardorsPhone)
	api.addMember(t, sardorsPhone, nok, "owner")

	rec := api.do(t, http.MethodGet, "/app/employees", "", bearer(owner))

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	list := members(t, rec)
	require.Len(t, list, 2, "the members of the company the owner works in, nobody else's")
	assert.Equal(t, alisPhone, list[0]["phone"], "the owner first")
	assert.Equal(t, "owner", list[0]["role"])
	assert.Equal(t, valisPhone, list[1]["phone"])
	assert.Equal(t, "Vali (hisobchi)", list[1]["full_name"], "under the name in this company")
	assert.Equal(t, "user", list[1]["role"])
	assert.NotEmpty(t, list[1]["created_at"])
}

func TestAddEmployee(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})

	rec := api.do(t, http.MethodPost, "/app/employees", `{"phone":"+998 90 222 33 44","full_name":" Vali "}`, bearer(owner))

	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	body := decode(t, rec)
	assert.Equal(t, valisPhone, body["phone"])
	assert.Equal(t, "Vali", body["full_name"])
	assert.Equal(t, "user", body["role"], "whoever the owner adds is a user")
	assert.NotEmpty(t, body["created_at"])
	list := members(t, api.do(t, http.MethodGet, "/app/employees", "", bearer(owner)))
	require.Len(t, list, 2)
	assert.Equal(t, valisPhone, list[1]["phone"], "the employee joins the list")
}

func TestAddEmployeeRefusals(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	const already = `{"error":"already_member","message":"Bu raqam kompaniyangizga allaqachon qo'shilgan"}`

	for name, tc := range map[string]struct {
		body   string
		status int
		want   string
	}{
		"the owner's own phone": {`{"phone":"` + alisPhone + `","full_name":"Ali"}`, http.StatusConflict, already},
		"an employee already":   {`{"phone":"90 222 33 44","full_name":"Boshqa Ism"}`, http.StatusConflict, already},
		"bad phone":             {`{"phone":"12ab","full_name":"Vali"}`, http.StatusBadRequest, `{"error":"validation_error","message":"Telefon raqami noto'g'ri"}`},
		"no name":               {`{"phone":"998903334455","full_name":" "}`, http.StatusBadRequest, `{"error":"validation_error","message":"Ismni kiriting"}`},
		"not JSON":              {`{"phone":`, http.StatusBadRequest, `{"error":"bad_request","message":"So'rov noto'g'ri"}`},
	} {
		rec := api.do(t, http.MethodPost, "/app/employees", tc.body, bearer(owner))
		assert.Equal(t, tc.status, rec.Code, name)
		assert.JSONEq(t, tc.want, rec.Body.String(), name)
	}

	rec := api.do(t, http.MethodPost, "/app/employees", `{"phone":"998903334455","full_name":"Sardor"}`, bearer(employee))
	assert.Equal(t, http.StatusForbidden, rec.Code, "an employee adds nobody")
	assert.Len(t, members(t, api.do(t, http.MethodGet, "/app/employees", "", bearer(owner))), 2, "nobody was added")
}

// login signs in a user who is in the database already: the tokens and the
// refresh token's cookie.
func (api testAPI) login(t *testing.T, phone string) (map[string]any, *http.Cookie) {
	t.Helper()
	require.Equal(t, http.StatusOK, api.do(t, http.MethodPost, "/app/auth/sms/send", `{"phone":"`+phone+`"}`).Code)
	rec := api.do(t, http.MethodPost, "/app/auth/sms/verify", `{"phone":"`+phone+`","code":"`+api.sms.code(t, phone)+`"}`)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	return decode(t, rec), refreshCookieOf(t, rec)
}

func TestAPhoneAddedByASecondCompanySignsInToChooseBetweenThem(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	nokOwner, _ := api.signIn(t, valisPhone, map[int64]string{nok: "owner"})

	// Nok's owner adds Ali, who owns Olma.
	rec := api.do(t, http.MethodPost, "/app/employees", `{"phone":"`+alisPhone+`","full_name":"Ali (hisobchi)"}`, bearer(nokOwner))

	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	added := decode(t, rec)
	assert.Equal(t, "Ali (hisobchi)", added["full_name"], "the answer a new phone would get: nothing of the other company shows")
	assert.Equal(t, "user", added["role"])

	tokens, refresh := api.login(t, alisPhone)
	assert.Nil(t, tokens["company_id"], "a member of two companies chooses one at sign-in")
	access, _ := tokens["access_token"].(string)
	me := decode(t, api.do(t, http.MethodGet, "/app/me", "", bearer(access)))
	companies, _ := me["companies"].([]any)
	roles := map[any]any{}
	for _, c := range companies {
		company, _ := c.(map[string]any)
		roles[company["name"]] = company["role"]
	}
	assert.Equal(t, map[any]any{"Olma": "owner", "Nok": "user"}, roles, "with a role of their own in each")

	rec = api.do(t, http.MethodPost, "/app/auth/switch-company", fmt.Sprintf(`{"company_id":%d}`, nok), bearer(access), cookie(refresh))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	access, _ = decode(t, rec)["access_token"].(string)
	me = decode(t, api.do(t, http.MethodGet, "/app/me", "", bearer(access)))
	user, _ := me["user"].(map[string]any)
	assert.Equal(t, "Ali (hisobchi)", user["full_name"], "and under the name that company gave them")
	assert.Equal(t, http.StatusForbidden, api.do(t, http.MethodGet, "/app/employees", "", bearer(access)).Code,
		"an owner elsewhere, a user here: Nok's employees are not theirs to see")
}

func TestRenameEmployee(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	api.addUser(t, valisPhone)
	api.addMember(t, valisPhone, olma, "user")

	rec := api.do(t, http.MethodPatch, "/app/employees/"+valisPhone, `{"full_name":" Vali (hisobchi) "}`, bearer(owner))

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	body := decode(t, rec)
	assert.Equal(t, valisPhone, body["phone"])
	assert.Equal(t, "Vali (hisobchi)", body["full_name"])
	assert.Equal(t, "user", body["role"])
	list := members(t, api.do(t, http.MethodGet, "/app/employees", "", bearer(owner)))
	require.Len(t, list, 2)
	assert.Equal(t, "Vali (hisobchi)", list[1]["full_name"], "the list shows the new name")
}

func TestRenameEmployeeRefusals(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	api.addUser(t, sardorsPhone)
	api.addMember(t, sardorsPhone, nok, "user")
	const notFound = `{"error":"not_found","message":"Xodim topilmadi"}`

	for name, tc := range map[string]struct {
		phone, body string
		status      int
		want        string
	}{
		"the owner":         {alisPhone, `{"full_name":"Boshqa"}`, http.StatusConflict, `{"error":"cannot_change_owner","message":"Kompaniya egasini o'zgartirib yoki o'chirib bo'lmaydi"}`},
		"another company's": {sardorsPhone, `{"full_name":"Boshqa"}`, http.StatusNotFound, notFound},
		"no such user":      {"998907777777", `{"full_name":"Boshqa"}`, http.StatusNotFound, notFound},
		"not a phone":       {"abc", `{"full_name":"Boshqa"}`, http.StatusNotFound, notFound},
		"no name":           {valisPhone, `{"full_name":" "}`, http.StatusBadRequest, `{"error":"validation_error","message":"Ismni kiriting"}`},
	} {
		rec := api.do(t, http.MethodPatch, "/app/employees/"+tc.phone, tc.body, bearer(owner))
		assert.Equal(t, tc.status, rec.Code, name)
		assert.JSONEq(t, tc.want, rec.Body.String(), name)
	}
	assert.Equal(t, http.StatusForbidden,
		api.do(t, http.MethodPatch, "/app/employees/"+valisPhone, `{"full_name":"O'zim"}`, bearer(employee)).Code,
		"an employee renames nobody, not even themselves")
	var inNok *string
	require.NoError(t, api.pool.QueryRow(t.Context(), "SELECT full_name FROM user_companies WHERE user_phone = $1", sardorsPhone).Scan(&inNok))
	assert.Nil(t, inNok, "another company's employee is out of reach")
}

func TestRemoveEmployee(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	api.addUser(t, valisPhone)
	api.addMember(t, valisPhone, olma, "user")

	rec := api.do(t, http.MethodDelete, "/app/employees/"+valisPhone, "", bearer(owner))

	assert.Equal(t, http.StatusNoContent, rec.Code, rec.Body.String())
	assert.Empty(t, rec.Body.String())
	list := members(t, api.do(t, http.MethodGet, "/app/employees", "", bearer(owner)))
	require.Len(t, list, 1, "the employee is off the list")
	assert.Equal(t, alisPhone, list[0]["phone"])
}

func TestRemoveEmployeeRefusals(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	employee, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	api.addUser(t, sardorsPhone)
	api.addMember(t, sardorsPhone, nok, "user")
	const notFound = `{"error":"not_found","message":"Xodim topilmadi"}`

	for name, tc := range map[string]struct {
		phone  string
		status int
		want   string
	}{
		"the owner, themselves": {alisPhone, http.StatusConflict, `{"error":"cannot_change_owner","message":"Kompaniya egasini o'zgartirib yoki o'chirib bo'lmaydi"}`},
		"another company's":     {sardorsPhone, http.StatusNotFound, notFound},
		"no such user":          {"998907777777", http.StatusNotFound, notFound},
	} {
		rec := api.do(t, http.MethodDelete, "/app/employees/"+tc.phone, "", bearer(owner))
		assert.Equal(t, tc.status, rec.Code, name)
		assert.JSONEq(t, tc.want, rec.Body.String(), name)
	}
	assert.Equal(t, http.StatusForbidden, api.do(t, http.MethodDelete, "/app/employees/"+valisPhone, "", bearer(employee)).Code,
		"an employee removes nobody, not even themselves")
	assert.Len(t, members(t, api.do(t, http.MethodGet, "/app/employees", "", bearer(owner))), 2, "everyone is still there")
	var inNok int
	require.NoError(t, api.pool.QueryRow(t.Context(), "SELECT count(*) FROM user_companies WHERE company_id = $1", nok).Scan(&inNok))
	assert.Equal(t, 1, inNok, "another company's employee is out of reach")
}

func TestARemovedEmployeeIsOutAtOnce(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	access, refresh := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	require.Equal(t, http.StatusOK, api.do(t, http.MethodGet, "/app/me", "", bearer(access)).Code)

	require.Equal(t, http.StatusNoContent, api.do(t, http.MethodDelete, "/app/employees/"+valisPhone, "", bearer(owner)).Code)

	rec := api.do(t, http.MethodGet, "/app/me", "", bearer(access))
	assert.Equal(t, http.StatusUnauthorized, rec.Code, "the access token still has minutes to live")
	assert.JSONEq(t, `{"error":"unauthorized","message":"Avval tizimga kiring"}`, rec.Body.String())
	rec = api.do(t, http.MethodPost, "/app/auth/refresh", "", cookie(refresh))
	assert.Equal(t, http.StatusUnauthorized, rec.Code, "no company left: the session is over")
	assert.JSONEq(t, `{"error":"invalid_refresh_token","message":"Sessiya tugagan. Qayta kiring"}`, rec.Body.String())
	api.sms.forget(valisPhone)
	rec = api.do(t, http.MethodPost, "/app/auth/sms/send", `{"phone":"`+valisPhone+`"}`)
	assert.Equal(t, http.StatusOK, rec.Code, "the same answer as ever")
	assert.Empty(t, api.sms.text(valisPhone), "but no code is texted: there is no way back in")
	var users int
	require.NoError(t, api.pool.QueryRow(t.Context(), "SELECT count(*) FROM users WHERE phone = $1", valisPhone).Scan(&users))
	assert.Equal(t, 1, users, "the user stays, to be added again one day")
}

func TestARemovedEmployeeKeepsTheirOtherCompanies(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	nok := api.addCompany(t, "Nok", 30)
	owner, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	access, refresh := api.signIn(t, valisPhone, map[int64]string{olma: "user", nok: "owner"})
	rec := api.do(t, http.MethodPost, "/app/auth/switch-company", fmt.Sprintf(`{"company_id":%d}`, olma), bearer(access), cookie(refresh))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	access, _ = decode(t, rec)["access_token"].(string)
	refresh = refreshCookieOf(t, rec)

	require.Equal(t, http.StatusNoContent, api.do(t, http.MethodDelete, "/app/employees/"+valisPhone, "", bearer(owner)).Code)

	assert.Equal(t, http.StatusUnauthorized, api.do(t, http.MethodGet, "/app/me", "", bearer(access)).Code, "out of Olma at once")
	rec = api.do(t, http.MethodPost, "/app/auth/refresh", "", cookie(refresh))
	require.Equal(t, http.StatusOK, rec.Code, "the session lives on: there is another company")
	tokens := decode(t, rec)
	assert.Nil(t, tokens["company_id"], "without the company they were taken out of")
	access, _ = tokens["access_token"].(string)
	me := decode(t, api.do(t, http.MethodGet, "/app/me", "", bearer(access)))
	companies, _ := me["companies"].([]any)
	require.Len(t, companies, 1)
	assert.Equal(t, "Nok", companies[0].(map[string]any)["name"], "their own company is theirs still")
}

func TestTheRoleIsReadAfreshOnEveryRequest(t *testing.T) {
	api := newTestAPI(t)
	olma := api.addCompany(t, "Olma", 30)
	ali, _ := api.signIn(t, alisPhone, map[int64]string{olma: "owner"})
	vali, _ := api.signIn(t, valisPhone, map[int64]string{olma: "user"})
	require.Equal(t, http.StatusOK, api.do(t, http.MethodGet, "/app/employees", "", bearer(ali)).Code)
	require.Equal(t, http.StatusForbidden, api.do(t, http.MethodGet, "/app/employees", "", bearer(vali)).Code)

	// The admin panel makes Vali the owner; both go on with the access
	// tokens they have, whose role claims are now out of date.
	api.exec(t, "UPDATE user_companies SET role = 'user' WHERE user_phone = $1", alisPhone)
	api.exec(t, "UPDATE user_companies SET role = 'owner' WHERE user_phone = $1", valisPhone)

	assert.Equal(t, http.StatusForbidden, api.do(t, http.MethodGet, "/app/employees", "", bearer(ali)).Code,
		"the owner before is a user from the next request on")
	assert.Equal(t, http.StatusOK, api.do(t, http.MethodGet, "/app/employees", "", bearer(vali)).Code,
		"and the new owner is the owner at once")
	me := decode(t, api.do(t, http.MethodGet, "/app/me", "", bearer(ali)))
	company, _ := me["company"].(map[string]any)
	assert.Equal(t, "user", company["role"], "/app/me tells the app so")
}
