package customer

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
	"github.com/SalikhovID/hisob24/backend/internal/testutil/pgtest"
)

// The members of a shop, by their phones.
const (
	owner = "998901111111" // Egamberdi Egasi
	staff = "998902222222" // Xurshid Xodim
)

// shop is a company set up for customers: its owner and a user of it, and
// two types. Jismoniy has a field of each kind, the name required; Yuridik
// has a name and an INN, both required, and the INN may not repeat.
type shop struct {
	id int64

	instagram, linkedin, youtube Option // the dropdown Manba
	erkak, ayol                  Option // Jins
	uzbek, rus                   Option // Til

	jismoniy                                   Type
	fish, yosh, manba, jinsi, tillar, kanallar Field
	yuridik                                    Type
	nomi, inn                                  Field
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
	sh := shop{id: addCompany(t, pool, name)}
	addMember(t, pool, sh.id, owner, "Egamberdi Egasi", "owner")
	addMember(t, pool, sh.id, staff, "Xurshid Xodim", "user")

	manba := mustDropdown(t, s, sh.id, "Manba")
	sh.instagram = mustOption(t, s, sh.id, manba.ID, "Instagram")
	sh.linkedin = mustOption(t, s, sh.id, manba.ID, "LinkedIn")
	sh.youtube = mustOption(t, s, sh.id, manba.ID, "YouTube")
	jins := mustDropdown(t, s, sh.id, "Jins")
	sh.erkak = mustOption(t, s, sh.id, jins.ID, "Erkak")
	sh.ayol = mustOption(t, s, sh.id, jins.ID, "Ayol")
	til := mustDropdown(t, s, sh.id, "Til")
	sh.uzbek = mustOption(t, s, sh.id, til.ID, "O'zbek")
	sh.rus = mustOption(t, s, sh.id, til.ID, "Rus")

	sh.jismoniy = mustType(t, s, sh.id, "Jismoniy")
	sh.fish = mustField(t, s, sh.id, sh.jismoniy.ID, FieldInput{Label: "F.I.Sh.", Kind: KindString, Required: true})
	sh.yosh = mustField(t, s, sh.id, sh.jismoniy.ID, FieldInput{Label: "Yoshi", Kind: KindInt})
	sh.manba = mustField(t, s, sh.id, sh.jismoniy.ID, FieldInput{Label: "Manba", Kind: KindDropdown, DropdownID: &manba.ID})
	sh.jinsi = mustField(t, s, sh.id, sh.jismoniy.ID, FieldInput{Label: "Jinsi", Kind: KindRadio, DropdownID: &jins.ID})
	sh.tillar = mustField(t, s, sh.id, sh.jismoniy.ID, FieldInput{Label: "Tillar", Kind: KindCheckbox, DropdownID: &til.ID})
	sh.kanallar = mustField(t, s, sh.id, sh.jismoniy.ID, FieldInput{Label: "Kanallar", Kind: KindMultiDropdown, DropdownID: &manba.ID})
	sh.yuridik = mustType(t, s, sh.id, "Yuridik")
	sh.nomi = mustField(t, s, sh.id, sh.yuridik.ID, FieldInput{Label: "Nomi", Kind: KindString, Required: true})
	sh.inn = mustField(t, s, sh.id, sh.yuridik.ID, FieldInput{Label: "INN", Kind: KindInt, Required: true, Unique: true})
	return sh
}

// answers is a customer's answers as a client sends them: JSON by the id of
// the field.
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

// storedAnswers is the customer's answers as they are stored, each row as
// "field: answer" with an option by its name, in the order of the fields.
func storedAnswers(t *testing.T, pool *pgxpool.Pool, customerID int64) []string {
	t.Helper()
	rows, err := pool.Query(t.Context(), `SELECT f.label || ': ' || COALESCE(v.text_value, v.int_value::text, o.label)
		FROM customer_values v
		JOIN customer_fields f ON f.id = v.field_id
		LEFT JOIN customer_dropdown_options o ON o.id = v.option_id
		WHERE v.customer_id = $1 ORDER BY f.position, o.position`, customerID)
	require.NoError(t, err)
	stored, err := pgx.CollectRows(rows, pgx.RowTo[string])
	require.NoError(t, err)
	return stored
}

func TestCreate(t *testing.T) {
	s, pool := newService(t)
	sh := newShop(t, s, pool, "Olma")

	c, err := s.Create(t.Context(), sh.id, staff, sh.jismoniy.ID, Input{
		Phone: "+998 90 123-45-67",
		Values: answers(t, map[int64]any{
			sh.fish.ID: " Ali Valiyev ", sh.yosh.ID: 30, sh.manba.ID: sh.instagram.ID, sh.jinsi.ID: sh.erkak.ID,
			sh.tillar.ID: []int64{sh.rus.ID, sh.uzbek.ID}, sh.kanallar.ID: []int64{sh.linkedin.ID},
		}),
	})

	require.NoError(t, err)
	assert.Positive(t, c.ID)
	assert.Equal(t, sh.jismoniy.ID, c.TypeID)
	assert.Equal(t, "998901234567", c.Phone, "the phone as it is kept")
	assert.Equal(t, Values{
		sh.fish.ID: "Ali Valiyev", sh.yosh.ID: int64(30), sh.manba.ID: sh.instagram.ID, sh.jinsi.ID: sh.erkak.ID,
		sh.tillar.ID: []int64{sh.uzbek.ID, sh.rus.ID}, sh.kanallar.ID: []int64{sh.linkedin.ID},
	}, c.Values, "the answers as they are kept")
	assert.Equal(t, ptr("Xurshid Xodim"), c.CreatedByName, "the member who entered the customer")
	assert.WithinDuration(t, time.Now(), c.CreatedAt, time.Minute)
	assert.Equal(t, c.CreatedAt, c.UpdatedAt, "not edited yet")

	var companyID, typeID int64
	var phone, by string
	var name *string
	require.NoError(t, pool.QueryRow(t.Context(),
		"SELECT company_id, type_id, phone, created_by, created_by_name FROM customers WHERE id = $1 AND deleted_at IS NULL", c.ID).
		Scan(&companyID, &typeID, &phone, &by, &name))
	assert.Equal(t, []any{sh.id, sh.jismoniy.ID, "998901234567", staff, ptr("Xurshid Xodim")}, []any{companyID, typeID, phone, by, name})
	assert.Equal(t, []string{
		"F.I.Sh.: Ali Valiyev", "Yoshi: 30", "Manba: Instagram", "Jinsi: Erkak", "Tillar: O'zbek", "Tillar: Rus", "Kanallar: LinkedIn",
	}, storedAnswers(t, pool, c.ID))
}

func TestCustomerPhone(t *testing.T) {
	for raw, want := range map[string]string{
		"998901234567":        "998901234567",
		"+998 90 123 45 67":   "998901234567",
		"+998 (90) 123-45-67": "998901234567",
		"901234567":           "998901234567", // a local number is an Uzbek one
		" 90 123 45 67 ":      "998901234567",
	} {
		got, err := customerPhone(raw)
		require.NoError(t, err, raw)
		assert.Equal(t, want, got, raw)
	}
	for _, raw := range []string{
		"", "   ", "12345", "90123456", "9989012345678", // too short or too long
		"+7 900 123 45 67", "79001234567", "449012345678", // not an Uzbek number
		"99890123456a", "ali", // not a number
	} {
		_, err := customerPhone(raw)
		refused(t, err, apperr.Invalid, "validation_error", "Telefon raqami noto'g'ri", raw)
	}
}

// count is how many rows a query counts.
func count(t *testing.T, pool *pgxpool.Pool, sql string, args ...any) int {
	t.Helper()
	var n int
	require.NoError(t, pool.QueryRow(t.Context(), sql, args...).Scan(&n))
	return n
}

func TestCreateRefusals(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := newShop(t, s, pool, "Olma")
	nok := newShop(t, s, pool, "Nok")
	gone := mustType(t, s, olma.id, "Eski")
	require.NoError(t, s.DeleteType(ctx, olma.id, gone.ID))
	const phone = "998901234567"

	for _, tt := range []struct {
		name    string
		typeID  int64
		phone   string
		values  map[int64]any
		refusal string
	}{
		{name: "a phone that is no Uzbek number", typeID: olma.jismoniy.ID, phone: "+7 900 123 45 67",
			values: map[int64]any{olma.fish.ID: "Ali"}, refusal: "Telefon raqami noto'g'ri"},
		{name: "no phone", typeID: olma.jismoniy.ID, values: map[int64]any{olma.fish.ID: "Ali"}, refusal: "Telefon raqami noto'g'ri"},
		{name: "no type", phone: phone, refusal: "Mijoz turini tanlang"},
		{name: "another company's type", typeID: nok.jismoniy.ID, phone: phone,
			values: map[int64]any{nok.fish.ID: "Ali"}, refusal: "Mijoz turini tanlang"},
		{name: "a deleted type", typeID: gone.ID, phone: phone, refusal: "Mijoz turini tanlang"},
		{name: "a required field left empty", typeID: olma.jismoniy.ID, phone: phone, refusal: "«F.I.Sh.» maydonini to'ldiring"},
		{name: "an answer to a field of another type", typeID: olma.jismoniy.ID, phone: phone,
			values: map[int64]any{olma.fish.ID: "Ali", olma.inn.ID: 5}, refusal: "Bu turda bunday maydon yo'q"},
		{name: "the phone is told before the type", phone: "ali", refusal: "Telefon raqami noto'g'ri"},
		{name: "the type is told before the answers", typeID: gone.ID, phone: phone,
			values: map[int64]any{olma.inn.ID: "x"}, refusal: "Mijoz turini tanlang"},
	} {
		_, err := s.Create(ctx, olma.id, owner, tt.typeID, Input{Phone: tt.phone, Values: answers(t, tt.values)})
		refused(t, err, apperr.Invalid, "validation_error", tt.refusal, tt.name)
	}
	assert.Zero(t, count(t, pool, "SELECT count(*) FROM customers"), "nobody is entered")
}

// mustCustomer enters a customer of the company's type, as the owner.
func mustCustomer(t *testing.T, s *Service, companyID, typeID int64, phone string, of map[int64]any) Customer {
	t.Helper()
	c, err := s.Create(t.Context(), companyID, owner, typeID, Input{Phone: phone, Values: answers(t, of)})
	require.NoError(t, err)
	return c
}

// takenBy asserts that err refuses a customer because the customer of the
// id given has its phone, or its answer, already.
func takenBy(t *testing.T, err error, code, message string, customerID int64, about ...any) {
	t.Helper()
	refused(t, err, apperr.Conflict, code, message, about...)
	var e *TakenError
	if assert.ErrorAs(t, err, &e, about...) {
		assert.Equal(t, customerID, e.CustomerID, about...)
	}
}

func TestCreateRefusesAPhoneAnotherCustomerHas(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := newShop(t, s, pool, "Olma")
	nok := newShop(t, s, pool, "Nok")
	ali := mustCustomer(t, s, olma.id, olma.jismoniy.ID, "998901234567", map[int64]any{olma.fish.ID: "Ali"})
	const taken = "Bu raqamli mijoz allaqachon bor"

	_, err := s.Create(ctx, olma.id, staff, olma.jismoniy.ID, Input{
		Phone: "+998 90 123 45 67", Values: answers(t, map[int64]any{olma.fish.ID: "Vali"}),
	})
	takenBy(t, err, "phone_taken", taken, ali.ID, "the same number, written another way")
	_, err = s.Create(ctx, olma.id, staff, olma.yuridik.ID, Input{
		Phone: "901234567", Values: answers(t, map[int64]any{olma.nomi.ID: "Olma MChJ", olma.inn.ID: 301234567}),
	})
	takenBy(t, err, "phone_taken", taken, ali.ID, "a customer of another type")
	_, err = s.Create(ctx, olma.id, staff, olma.jismoniy.ID, Input{Phone: "998901234567"})
	refused(t, err, apperr.Invalid, "validation_error", "«F.I.Sh.» maydonini to'ldiring", "what is wrong with the answers is told first")
	assert.Equal(t, 1, count(t, pool, "SELECT count(*) FROM customers WHERE company_id = $1", olma.id), "nobody else is entered")

	mustCustomer(t, s, nok.id, nok.jismoniy.ID, "998901234567", map[int64]any{nok.fish.ID: "Ali"}) // another company's customer
	_, err = pool.Exec(ctx, "UPDATE customers SET deleted_at = now() WHERE id = $1", ali.ID)
	require.NoError(t, err)
	mustCustomer(t, s, olma.id, olma.jismoniy.ID, "998901234567", map[int64]any{olma.fish.ID: "Vali"}) // a deleted customer's number is free
}

func TestCreateRefusesAnAnswerThatMayNotRepeat(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := newShop(t, s, pool, "Olma")
	nok := newShop(t, s, pool, "Nok")
	// A text that may not repeat, beside the INN, which is a number.
	pasport := mustField(t, s, olma.id, olma.jismoniy.ID, FieldInput{Label: "Pasport", Kind: KindString, Unique: true})
	firma := mustCustomer(t, s, olma.id, olma.yuridik.ID, "998900000001", map[int64]any{olma.nomi.ID: "Olma MChJ", olma.inn.ID: 301234567})
	ali := mustCustomer(t, s, olma.id, olma.jismoniy.ID, "998900000002", map[int64]any{olma.fish.ID: "Ali", pasport.ID: "AA1234567"})
	// create enters a customer of Olma's as the user.
	create := func(typeID int64, phone string, of map[int64]any) error {
		_, err := s.Create(ctx, olma.id, staff, typeID, Input{Phone: phone, Values: answers(t, of)})
		return err
	}

	err := create(olma.yuridik.ID, "998900000003", map[int64]any{olma.nomi.ID: "Nok MChJ", olma.inn.ID: 301234567})
	takenBy(t, err, "value_taken", "Bu «INN» boshqa mijozda bor", firma.ID, "a whole number")
	err = create(olma.jismoniy.ID, "998900000004", map[int64]any{olma.fish.ID: "Vali", pasport.ID: " aa1234567 "})
	takenBy(t, err, "value_taken", "Bu «Pasport» boshqa mijozda bor", ali.ID, "a text, in any case")
	err = create(olma.yuridik.ID, "998900000001", map[int64]any{olma.nomi.ID: "Nok MChJ", olma.inn.ID: 301234567})
	takenBy(t, err, "phone_taken", "Bu raqamli mijoz allaqachon bor", firma.ID, "the phone is told before the answer")
	assert.Equal(t, 2, count(t, pool, "SELECT count(*) FROM customers WHERE company_id = $1", olma.id), "nobody else is entered")

	assert.NoError(t, create(olma.jismoniy.ID, "998900000005", map[int64]any{olma.fish.ID: "Ali"}), "a field that may repeat")
	assert.NoError(t, create(olma.jismoniy.ID, "998900000006", map[int64]any{olma.fish.ID: "Vali"}), "no answer is no repeat")
	assert.NoError(t, create(olma.jismoniy.ID, "998900000007", map[int64]any{olma.fish.ID: "Soli"}), "nor is another one")
	mustCustomer(t, s, nok.id, nok.yuridik.ID, "998900000001", map[int64]any{nok.nomi.ID: "Olma MChJ", nok.inn.ID: 301234567}) // another company
	_, err = pool.Exec(ctx, "UPDATE customers SET deleted_at = now() WHERE id = $1", firma.ID)
	require.NoError(t, err)
	assert.NoError(t, create(olma.yuridik.ID, "998900000008", map[int64]any{olma.nomi.ID: "Yangi MChJ", olma.inn.ID: 301234567}),
		"a deleted customer's answer is free")
}

// storedHistory is the customer's history as it is stored, the oldest
// first, each entry as "action by phone (name): changes".
func storedHistory(t *testing.T, pool *pgxpool.Pool, customerID int64) []string {
	t.Helper()
	rows, err := pool.Query(t.Context(), `SELECT action || ' by ' || actor_phone || ' (' || COALESCE(actor_name, '-') || '): ' || changes::text
		FROM customer_history WHERE customer_id = $1 ORDER BY id`, customerID)
	require.NoError(t, err)
	history, err := pgx.CollectRows(rows, pgx.RowTo[string])
	require.NoError(t, err)
	return history
}

func TestCreateWritesDownWhoEnteredTheCustomer(t *testing.T) {
	s, pool := newService(t)
	sh := newShop(t, s, pool, "Olma")

	c, err := s.Create(t.Context(), sh.id, staff, sh.jismoniy.ID, Input{
		Phone: "998901234567", Values: answers(t, map[int64]any{sh.fish.ID: "Ali"}),
	})

	require.NoError(t, err)
	assert.Equal(t, []string{"created by 998902222222 (Xurshid Xodim): []"}, storedHistory(t, pool, c.ID))
}

// The API lets only a member through, but the member may be taken out of
// the company before the write: the customer is entered under no name.
func TestCreateByAUserWhoIsNoMemberNamesNobody(t *testing.T) {
	s, pool := newService(t)
	sh := newShop(t, s, pool, "Olma")
	_, err := pool.Exec(t.Context(), "DELETE FROM user_companies WHERE user_phone = $1", staff)
	require.NoError(t, err)

	c, err := s.Create(t.Context(), sh.id, staff, sh.jismoniy.ID, Input{
		Phone: "998901234567", Values: answers(t, map[int64]any{sh.fish.ID: "Ali"}),
	})

	require.NoError(t, err)
	assert.Nil(t, c.CreatedByName)
	assert.Equal(t, []string{"created by 998902222222 (-): []"}, storedHistory(t, pool, c.ID))
}

func TestCreateEntersACustomerWhollyOrNotAtAll(t *testing.T) {
	for _, table := range []string{"customer_values", "customer_history"} {
		t.Run(table, func(t *testing.T) {
			s, pool := newService(t)
			sh := newShop(t, s, pool, "Olma")
			pgtest.FailInserts(t, pool, table)

			_, err := s.Create(t.Context(), sh.id, owner, sh.jismoniy.ID, Input{
				Phone: "998901234567", Values: answers(t, map[int64]any{sh.fish.ID: "Ali"}),
			})

			require.Error(t, err)
			assert.Zero(t, count(t, pool, "SELECT count(*) FROM customers"), "no customer without its answers and its history")
			assert.Zero(t, count(t, pool, "SELECT count(*) FROM customer_values"))
		})
	}
}

const customerNotFound = "Mijoz topilmadi"

// hide deletes a customer the way the service does, without its history.
func hide(t *testing.T, pool *pgxpool.Pool, customerID int64) {
	t.Helper()
	_, err := pool.Exec(t.Context(), "UPDATE customers SET deleted_at = now() WHERE id = $1", customerID)
	require.NoError(t, err)
}

func TestGet(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := newShop(t, s, pool, "Olma")
	nok := newShop(t, s, pool, "Nok")
	ali, err := s.Create(ctx, olma.id, staff, olma.jismoniy.ID, Input{
		Phone: "998901234567",
		Values: answers(t, map[int64]any{
			olma.fish.ID: "Ali Valiyev", olma.yosh.ID: 0, olma.manba.ID: olma.linkedin.ID, olma.jinsi.ID: olma.ayol.ID,
			olma.tillar.ID: []int64{olma.rus.ID, olma.uzbek.ID}, olma.kanallar.ID: []int64{olma.youtube.ID, olma.instagram.ID},
		}),
	})
	require.NoError(t, err)
	vali := mustCustomer(t, s, olma.id, olma.jismoniy.ID, "998905555555", map[int64]any{olma.fish.ID: "Vali"})
	bare := mustCustomer(t, s, olma.id, mustType(t, s, olma.id, "Maydonsiz").ID, "998907777777", nil)

	got, err := s.Get(ctx, olma.id, ali.ID)

	require.NoError(t, err)
	assert.Equal(t, ali, got, "the customer as it was entered")
	assert.Equal(t, Values{
		olma.fish.ID: "Ali Valiyev", olma.yosh.ID: int64(0), olma.manba.ID: olma.linkedin.ID, olma.jinsi.ID: olma.ayol.ID,
		olma.tillar.ID: []int64{olma.uzbek.ID, olma.rus.ID}, olma.kanallar.ID: []int64{olma.instagram.ID, olma.youtube.ID},
	}, got.Values, "an answer of each kind")
	assert.Equal(t, ptr("Xurshid Xodim"), got.CreatedByName)
	got, err = s.Get(ctx, olma.id, vali.ID)
	require.NoError(t, err)
	assert.Equal(t, Values{olma.fish.ID: "Vali"}, got.Values, "the fields left empty have no answer")
	got, err = s.Get(ctx, olma.id, bare.ID)
	require.NoError(t, err)
	assert.Equal(t, Values{}, got.Values, "a customer with no answers")

	_, err = s.Get(ctx, nok.id, ali.ID)
	refused(t, err, apperr.NotFound, "not_found", customerNotFound, "another company's customer")
	_, err = s.Get(ctx, olma.id, 1<<40)
	refused(t, err, apperr.NotFound, "not_found", customerNotFound, "a customer that is not there")
	hide(t, pool, ali.ID)
	_, err = s.Get(ctx, olma.id, ali.ID)
	refused(t, err, apperr.NotFound, "not_found", customerNotFound, "a deleted customer")
}

func TestList(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := newShop(t, s, pool, "Olma")
	nok := newShop(t, s, pool, "Nok")
	var entered []Customer
	for i := range 21 {
		entered = append(entered, mustCustomer(t, s, olma.id, olma.jismoniy.ID, fmt.Sprintf("9989000000%02d", i),
			map[int64]any{olma.fish.ID: fmt.Sprintf("Mijoz %d", i), olma.tillar.ID: []int64{olma.rus.ID, olma.uzbek.ID}}))
	}
	hide(t, pool, mustCustomer(t, s, olma.id, olma.jismoniy.ID, "998909999999", map[int64]any{olma.fish.ID: "O'chirilgan"}).ID)
	mustCustomer(t, s, nok.id, nok.jismoniy.ID, "998900000000", map[int64]any{nok.fish.ID: "Begona"})

	first, err := s.List(ctx, olma.id, ListInput{Page: 1})

	require.NoError(t, err)
	assert.EqualValues(t, 21, first.Total, "the company's own, without the deleted one")
	assert.Equal(t, 1, first.Page)
	assert.Equal(t, 20, first.PageSize)
	require.Len(t, first.Items, 20, "a page holds twenty")
	assert.Equal(t, entered[20], first.Items[0], "the newest first, as it was entered")
	assert.Equal(t, entered[1], first.Items[19])

	second, err := s.List(ctx, olma.id, ListInput{Page: 2})
	require.NoError(t, err)
	assert.Equal(t, []Customer{entered[0]}, second.Items, "the oldest is on the last page")
	assert.EqualValues(t, 21, second.Total)
	assert.Equal(t, 2, second.Page)
	past, err := s.List(ctx, olma.id, ListInput{Page: 3})
	require.NoError(t, err)
	assert.Equal(t, []Customer{}, past.Items, "a page past the last is empty")
	assert.EqualValues(t, 21, past.Total)

	for _, page := range []int{0, -1, 1_000_001} {
		_, err = s.List(ctx, olma.id, ListInput{Page: page})
		refused(t, err, apperr.Invalid, "validation_error", "Sahifa raqami noto'g'ri", page)
	}
	none, err := s.List(ctx, addCompany(t, pool, "Behi"), ListInput{Page: 1})
	require.NoError(t, err)
	assert.Equal(t, Page{Items: []Customer{}, Total: 0, Page: 1, PageSize: 20}, none, "a company with no customers")
}

// phones is the phones of the customers, in their order.
func phones(customers []Customer) []string {
	list := make([]string, 0, len(customers))
	for _, c := range customers {
		list = append(list, c.Phone)
	}
	return list
}

// The customers of seedCustomers, by their phones.
const (
	aliPhone   = "998901234567" // Jismoniy: Ali Valiyev, 30, from Instagram
	valiPhone  = "998905555555" // Jismoniy: Vali Aliyev, 45
	firmaPhone = "998907777777" // Yuridik: Olma 100% MChJ, INN 301234567
)

// seedCustomers enters Ali, Vali and a firm into the shop, in that order.
func seedCustomers(t *testing.T, s *Service, sh shop) {
	t.Helper()
	mustCustomer(t, s, sh.id, sh.jismoniy.ID, aliPhone,
		map[int64]any{sh.fish.ID: "Ali Valiyev", sh.yosh.ID: 30, sh.manba.ID: sh.instagram.ID})
	mustCustomer(t, s, sh.id, sh.jismoniy.ID, valiPhone, map[int64]any{sh.fish.ID: "Vali Aliyev", sh.yosh.ID: 45})
	mustCustomer(t, s, sh.id, sh.yuridik.ID, firmaPhone, map[int64]any{sh.nomi.ID: "Olma 100% MChJ", sh.inn.ID: 301234567})
}

func TestListOfOneType(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := newShop(t, s, pool, "Olma")
	seedCustomers(t, s, olma)

	for _, tt := range []struct {
		name   string
		typeID int64
		want   []string
	}{
		{name: "every type", want: []string{firmaPhone, valiPhone, aliPhone}},
		{name: "Jismoniy", typeID: olma.jismoniy.ID, want: []string{valiPhone, aliPhone}},
		{name: "Yuridik", typeID: olma.yuridik.ID, want: []string{firmaPhone}},
		{name: "a type that is not there", typeID: 1 << 40, want: []string{}},
	} {
		page, err := s.List(ctx, olma.id, ListInput{TypeID: tt.typeID, Page: 1})
		require.NoError(t, err, tt.name)
		assert.Equal(t, tt.want, phones(page.Items), tt.name)
		assert.EqualValues(t, len(tt.want), page.Total, tt.name)
	}
}

func TestListSearch(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := newShop(t, s, pool, "Olma")
	seedCustomers(t, s, olma)
	nok := newShop(t, s, pool, "Nok")
	mustCustomer(t, s, nok.id, nok.jismoniy.ID, aliPhone, map[int64]any{nok.fish.ID: "Ali Begona"})
	hide(t, pool, mustCustomer(t, s, olma.id, olma.jismoniy.ID, "998909999999", map[int64]any{olma.fish.ID: "Ali O'chirilgan"}).ID)

	for _, tt := range []struct {
		name   string
		search string
		typeID int64
		want   []string
	}{
		{name: "a part of a text answer, in any case", search: "ALI", want: []string{valiPhone, aliPhone}},
		{name: "the spaces around the search do not count", search: "  valiyev ", want: []string{aliPhone}},
		{name: "a phone as people write it", search: "+998 (90) 555-55", want: []string{valiPhone}},
		{name: "digits, in the phones and in the whole numbers", search: "0123", want: []string{firmaPhone, aliPhone}},
		{name: "a whole number", search: "301234567", want: []string{firmaPhone}},
		{name: "digits inside a text answer", search: "100", want: []string{firmaPhone}},
		{name: "a percent sign is a percent sign", search: "100%", want: []string{firmaPhone}},
		{name: "an underscore is an underscore", search: "_", want: []string{}},
		{name: "a backslash is a backslash", search: `\`, want: []string{}},
		{name: "letters with digits are looked for as a text", search: "olma 100", want: []string{firmaPhone}},
		{name: "and not as digits in the phones", search: "ali 5", want: []string{}},
		{name: "an option's name is not searched", search: "Instagram", want: []string{}},
		{name: "within one type", search: "ali", typeID: olma.yuridik.ID, want: []string{}},
		{name: "nobody found", search: "zzz", want: []string{}},
		{name: "spaces alone are no search", search: "   ", want: []string{firmaPhone, valiPhone, aliPhone}},
	} {
		page, err := s.List(ctx, olma.id, ListInput{Search: tt.search, TypeID: tt.typeID, Page: 1})
		require.NoError(t, err, tt.name)
		assert.Equal(t, tt.want, phones(page.Items), tt.name)
		assert.EqualValues(t, len(tt.want), page.Total, tt.name)
	}
}

// age makes every customer a day old, so that an edit shows.
func age(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	_, err := pool.Exec(t.Context(),
		"UPDATE customers SET created_at = now() - interval '1 day', updated_at = now() - interval '1 day'")
	require.NoError(t, err)
}

func TestUpdate(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := newShop(t, s, pool, "Olma")
	ali, err := s.Create(ctx, olma.id, staff, olma.jismoniy.ID, Input{
		Phone: "998901234567",
		Values: answers(t, map[int64]any{
			olma.fish.ID: "Ali Valiyev", olma.yosh.ID: 30, olma.manba.ID: olma.instagram.ID,
			olma.tillar.ID: []int64{olma.uzbek.ID, olma.rus.ID},
		}),
	})
	require.NoError(t, err)
	vali := mustCustomer(t, s, olma.id, olma.jismoniy.ID, "998905555555", map[int64]any{olma.fish.ID: "Vali", olma.yosh.ID: 45})
	age(t, pool)

	got, err := s.Update(ctx, olma.id, ali.ID, owner, Input{
		Phone: "+998 90 765 43 21",
		Values: answers(t, map[int64]any{
			olma.fish.ID: " Ali Valiyev ", olma.yosh.ID: 31, olma.jinsi.ID: olma.erkak.ID, olma.tillar.ID: []int64{olma.rus.ID},
		}),
	})

	require.NoError(t, err)
	assert.Equal(t, ali.ID, got.ID)
	assert.Equal(t, olma.jismoniy.ID, got.TypeID, "of the type it was")
	assert.Equal(t, "998907654321", got.Phone)
	assert.Equal(t, Values{
		olma.fish.ID: "Ali Valiyev", olma.yosh.ID: int64(31), olma.jinsi.ID: olma.erkak.ID, olma.tillar.ID: []int64{olma.rus.ID},
	}, got.Values, "the answers of the edit, and none of those it left out")
	assert.Equal(t, ptr("Xurshid Xodim"), got.CreatedByName, "entered by whom it was")
	assert.WithinDuration(t, time.Now().Add(-24*time.Hour), got.CreatedAt, time.Minute, "and when it was")
	assert.WithinDuration(t, time.Now(), got.UpdatedAt, time.Minute, "edited now")

	read, err := s.Get(ctx, olma.id, ali.ID)
	require.NoError(t, err)
	assert.Equal(t, got, read, "what the edit returns is what is kept")
	assert.Equal(t, []string{"F.I.Sh.: Ali Valiyev", "Yoshi: 31", "Jinsi: Erkak", "Tillar: Rus"}, storedAnswers(t, pool, ali.ID))
	other, err := s.Get(ctx, olma.id, vali.ID)
	require.NoError(t, err)
	assert.Equal(t, "998905555555", other.Phone, "the other customers stay as they are")
	assert.Equal(t, vali.Values, other.Values)
	assert.Equal(t, other.CreatedAt, other.UpdatedAt)
}

// entry is one entry of a customer's history as it is stored.
type entry struct {
	Action  string
	Actor   string
	Name    *string
	Changes []Change
}

// entriesOf is the customer's history as it is stored, the oldest first.
func entriesOf(t *testing.T, pool *pgxpool.Pool, customerID int64) []entry {
	t.Helper()
	rows, err := pool.Query(t.Context(),
		"SELECT action, actor_phone, actor_name, changes FROM customer_history WHERE customer_id = $1 ORDER BY id", customerID)
	require.NoError(t, err)
	var entries []entry
	var e entry
	var changes []byte
	_, err = pgx.ForEachRow(rows, []any{&e.Action, &e.Actor, &e.Name, &changes}, func() error {
		e.Changes = nil
		require.NoError(t, json.Unmarshal(changes, &e.Changes))
		entries = append(entries, e)
		return nil
	})
	require.NoError(t, err)
	return entries
}

func TestUpdateWritesDownWhatChanged(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := newShop(t, s, pool, "Olma")
	ali, err := s.Create(ctx, olma.id, staff, olma.jismoniy.ID, Input{
		Phone: "998901234567",
		Values: answers(t, map[int64]any{
			olma.fish.ID: "Ali Valiyev", olma.yosh.ID: 30, olma.manba.ID: olma.instagram.ID,
			olma.tillar.ID: []int64{olma.uzbek.ID, olma.rus.ID},
		}),
	})
	require.NoError(t, err)

	_, err = s.Update(ctx, olma.id, ali.ID, owner, Input{
		Phone: "998907654321",
		Values: answers(t, map[int64]any{
			olma.fish.ID: "Ali Valiyev", olma.yosh.ID: 31, olma.jinsi.ID: olma.erkak.ID, olma.tillar.ID: []int64{olma.rus.ID},
		}),
	})

	require.NoError(t, err)
	edit := entry{Action: "updated", Actor: owner, Name: ptr("Egamberdi Egasi"), Changes: []Change{
		{Label: "Telefon", Old: "+998 90 123 45 67", New: "+998 90 765 43 21"},
		{Label: "Yoshi", Old: "30", New: "31"},
		{Label: "Manba", Old: "Instagram", New: ""},
		{Label: "Jinsi", Old: "", New: "Erkak"},
		{Label: "Tillar", Old: "O'zbek, Rus", New: "Rus"},
	}}
	require.Equal(t, []entry{
		{Action: "created", Actor: staff, Name: ptr("Xurshid Xodim"), Changes: []Change{}},
		edit,
	}, entriesOf(t, pool, ali.ID), "who edited, and each field that changed: before and after")

	// The history is kept as text: names given later do not rewrite it.
	_, err = s.UpdateField(ctx, olma.id, olma.jismoniy.ID, olma.yosh.ID, FieldPatch{Label: ptr("Yosh")})
	require.NoError(t, err)
	_, err = pool.Exec(ctx, "UPDATE customer_dropdown_options SET label = 'Ruscha' WHERE id = $1", olma.rus.ID)
	require.NoError(t, err)
	assert.Equal(t, edit, entriesOf(t, pool, ali.ID)[1], "under the names of that time")
}

func TestUpdateThatChangesNothingWritesNothing(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := newShop(t, s, pool, "Olma")
	ali := mustCustomer(t, s, olma.id, olma.jismoniy.ID, "998901234567", map[int64]any{
		olma.fish.ID: "Ali Valiyev", olma.yosh.ID: 30, olma.manba.ID: olma.linkedin.ID,
		olma.tillar.ID: []int64{olma.uzbek.ID, olma.rus.ID},
	})
	// The owner has put the languages in another order since.
	require.NoError(t, s.OrderOptions(ctx, olma.id, *olma.tillar.DropdownID, []int64{olma.rus.ID, olma.uzbek.ID}))
	age(t, pool)
	before, err := s.Get(ctx, olma.id, ali.ID)
	require.NoError(t, err)

	got, err := s.Update(ctx, olma.id, ali.ID, staff, Input{
		Phone: "+998 90 123 45 67",
		Values: answers(t, map[int64]any{
			olma.fish.ID: " Ali Valiyev ", olma.yosh.ID: 30, olma.manba.ID: olma.linkedin.ID,
			olma.tillar.ID: []int64{olma.uzbek.ID, olma.rus.ID}, olma.jinsi.ID: nil, olma.kanallar.ID: []int64{},
		}),
	})

	require.NoError(t, err)
	assert.Equal(t, before, got, "the customer as it was: not edited")
	assert.Len(t, entriesOf(t, pool, ali.ID), 1, "nothing for the history")
	read, err := s.Get(ctx, olma.id, ali.ID)
	require.NoError(t, err)
	assert.Equal(t, before, read)
}

func TestUpdateKeepsATurnedOffOptionTheCustomerHas(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := newShop(t, s, pool, "Olma")
	ali := mustCustomer(t, s, olma.id, olma.jismoniy.ID, aliPhone, map[int64]any{
		olma.fish.ID: "Ali", olma.manba.ID: olma.youtube.ID, olma.kanallar.ID: []int64{olma.instagram.ID, olma.youtube.ID},
	})
	vali := mustCustomer(t, s, olma.id, olma.jismoniy.ID, valiPhone, map[int64]any{olma.fish.ID: "Vali", olma.manba.ID: olma.instagram.ID})
	_, err := s.UpdateOption(ctx, olma.id, *olma.manba.DropdownID, olma.youtube.ID, OptionPatch{Active: ptr(false)})
	require.NoError(t, err)
	const wrong = "«Manba» uchun variant noto'g'ri"

	got, err := s.Update(ctx, olma.id, ali.ID, owner, Input{Phone: aliPhone, Values: answers(t, map[int64]any{
		olma.fish.ID: "Ali Valiyev", olma.manba.ID: olma.youtube.ID, olma.kanallar.ID: []int64{olma.youtube.ID, olma.linkedin.ID},
	})})

	require.NoError(t, err, "the customer who has the option keeps it through an edit")
	assert.Equal(t, Values{
		olma.fish.ID: "Ali Valiyev", olma.manba.ID: olma.youtube.ID, olma.kanallar.ID: []int64{olma.linkedin.ID, olma.youtube.ID},
	}, got.Values)

	_, err = s.Update(ctx, olma.id, vali.ID, owner, Input{Phone: valiPhone, Values: answers(t, map[int64]any{
		olma.fish.ID: "Vali", olma.manba.ID: olma.youtube.ID,
	})})
	refused(t, err, apperr.Invalid, "validation_error", wrong, "a customer who has it not cannot take it")
	_, err = s.Create(ctx, olma.id, owner, olma.jismoniy.ID, Input{Phone: "998900000009", Values: answers(t, map[int64]any{
		olma.fish.ID: "Soli", olma.manba.ID: olma.youtube.ID,
	})})
	refused(t, err, apperr.Invalid, "validation_error", wrong, "nor can a new customer")

	// Once Ali gives the option up, it is gone for Ali too.
	_, err = s.Update(ctx, olma.id, ali.ID, owner, Input{Phone: aliPhone, Values: answers(t, map[int64]any{olma.fish.ID: "Ali Valiyev"})})
	require.NoError(t, err)
	_, err = s.Update(ctx, olma.id, ali.ID, owner, Input{Phone: aliPhone, Values: answers(t, map[int64]any{
		olma.fish.ID: "Ali Valiyev", olma.manba.ID: olma.youtube.ID,
	})})
	refused(t, err, apperr.Invalid, "validation_error", wrong, "given up, it cannot be taken back")
}

func TestUpdateRefusals(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := newShop(t, s, pool, "Olma")
	nok := newShop(t, s, pool, "Nok")
	ali := mustCustomer(t, s, olma.id, olma.jismoniy.ID, aliPhone, map[int64]any{olma.fish.ID: "Ali"})
	vali := mustCustomer(t, s, olma.id, olma.jismoniy.ID, valiPhone, map[int64]any{olma.fish.ID: "Vali"})
	firma := mustCustomer(t, s, olma.id, olma.yuridik.ID, firmaPhone, map[int64]any{olma.nomi.ID: "Olma MChJ", olma.inn.ID: 301234567})
	boshqa := mustCustomer(t, s, olma.id, olma.yuridik.ID, "998900000001", map[int64]any{olma.nomi.ID: "Nok MChJ", olma.inn.ID: 305555555})
	begona := mustCustomer(t, s, nok.id, nok.jismoniy.ID, "998900000002", map[int64]any{nok.fish.ID: "Begona"})
	gone := mustCustomer(t, s, olma.id, olma.jismoniy.ID, "998900000003", map[int64]any{olma.fish.ID: "O'chirilgan"})
	hide(t, pool, gone.ID)
	// update edits a customer of Olma's as the user.
	update := func(id int64, phone string, of map[int64]any) error {
		_, err := s.Update(ctx, olma.id, id, staff, Input{Phone: phone, Values: answers(t, of)})
		return err
	}
	name := map[int64]any{olma.fish.ID: "Ali"}

	refused(t, update(begona.ID, "998900000002", map[int64]any{nok.fish.ID: "Begona"}), apperr.NotFound, "not_found", customerNotFound, "another company's customer")
	refused(t, update(gone.ID, "998900000003", name), apperr.NotFound, "not_found", customerNotFound, "a deleted customer")
	refused(t, update(1<<40, "12345", nil), apperr.NotFound, "not_found", customerNotFound, "a customer that is not there, whatever is sent")

	refused(t, update(ali.ID, "12345", name), apperr.Invalid, "validation_error", "Telefon raqami noto'g'ri")
	refused(t, update(ali.ID, aliPhone, nil), apperr.Invalid, "validation_error", "«F.I.Sh.» maydonini to'ldiring")
	refused(t, update(ali.ID, aliPhone, map[int64]any{olma.fish.ID: "Ali", olma.inn.ID: 5}),
		apperr.Invalid, "validation_error", "Bu turda bunday maydon yo'q", "the customer stays of its type")

	takenBy(t, update(ali.ID, "+998 90 555 55 55", name), "phone_taken", "Bu raqamli mijoz allaqachon bor", vali.ID)
	takenBy(t, update(boshqa.ID, "998900000001", map[int64]any{olma.nomi.ID: "Nok MChJ", olma.inn.ID: 301234567}),
		"value_taken", "Bu «INN» boshqa mijozda bor", firma.ID)
	takenBy(t, update(boshqa.ID, firmaPhone, map[int64]any{olma.nomi.ID: "Nok MChJ", olma.inn.ID: 301234567}),
		"phone_taken", "Bu raqamli mijoz allaqachon bor", firma.ID, "the phone is told before the answer")

	unchanged, err := s.Get(ctx, olma.id, ali.ID)
	require.NoError(t, err)
	assert.Equal(t, ali, unchanged, "a refused edit changes nothing")
	assert.Len(t, entriesOf(t, pool, ali.ID), 1, "and writes nothing down")

	assert.NoError(t, update(firma.ID, firmaPhone, map[int64]any{olma.nomi.ID: "Olma Savdo MChJ", olma.inn.ID: 301234567}),
		"a customer's own phone and own answer are no repeat")
	assert.NoError(t, update(ali.ID, "998900000003", name), "a deleted customer's phone is free")

	// A field made required since the customer was entered is asked for at the next save.
	_, err = s.UpdateField(ctx, olma.id, olma.jismoniy.ID, olma.yosh.ID, FieldPatch{Required: ptr(true)})
	require.NoError(t, err)
	refused(t, update(vali.ID, valiPhone, map[int64]any{olma.fish.ID: "Vali Aliyev"}),
		apperr.Invalid, "validation_error", "«Yoshi» maydonini to'ldiring")
}
