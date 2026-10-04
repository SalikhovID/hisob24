package customer

import (
	"encoding/json"
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
