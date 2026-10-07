package catalog

import (
	"context"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/testutil/pgtest"
)

const (
	ali  = "998901111111"
	vali = "998902222222"
)

func newService(t *testing.T) (*Service, *pgxpool.Pool) {
	t.Helper()
	t.Parallel()
	pool := pgtest.New(t)
	return NewService(pool), pool
}

// addCompany inserts a company with Ali as its owner (named "Ali aka"
// there) and Vali as a user with no name, and returns its id.
func addCompany(t *testing.T, pool *pgxpool.Pool, name string) int64 {
	t.Helper()
	ctx := t.Context()
	var id int64
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO companies (name, end_date) VALUES ($1, CURRENT_DATE) RETURNING id", name).Scan(&id))
	_, err := pool.Exec(ctx, "INSERT INTO users (phone) VALUES ($1), ($2) ON CONFLICT DO NOTHING", ali, vali)
	require.NoError(t, err)
	_, err = pool.Exec(ctx, "INSERT INTO user_companies (user_phone, company_id, role, full_name) VALUES ($1, $2, 'owner', 'Ali aka'), ($3, $2, 'user', NULL)", ali, id, vali)
	require.NoError(t, err)
	return id
}

// refused asserts that err is a refusal for the client, of the kind, code
// and message given.
func refused(t *testing.T, err error, kind apperr.Kind, code, message string, about ...any) {
	t.Helper()
	var e *apperr.Error
	if assert.ErrorAs(t, err, &e, about...) {
		assert.Equal(t, kind, e.Kind, about...)
		assert.Equal(t, code, e.Code, about...)
		assert.Equal(t, message, e.Message, about...)
	}
}

func product(name, unit string) Input {
	return Input{Kind: KindProduct, Name: name, Unit: ptr(unit)}
}

func TestCreate(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := addCompany(t, pool, "Olma")
	nok := addCompany(t, pool, "Nok")

	p, err := s.Create(ctx, olma, ali, Input{Kind: KindProduct, Name: " Olma ", Unit: ptr("kg"), SKU: ptr("A-1"), Price: ptr("12000.5"), Note: ptr("Qizil")})
	require.NoError(t, err)
	assert.Positive(t, p.ID)
	assert.Equal(t, KindProduct, p.Kind)
	assert.Equal(t, "Olma", p.Name, "trimmed")
	assert.Equal(t, ptr("kg"), p.Unit)
	assert.Equal(t, ptr("A-1"), p.SKU)
	assert.Equal(t, ptr("12000.50"), p.Price, "two decimals, as the database writes it")
	assert.Equal(t, ptr("Qizil"), p.Note)
	assert.True(t, p.Active)
	assert.Equal(t, ptr("Ali aka"), p.CreatedByName, "the name the member goes by in the company")
	assert.Equal(t, p.CreatedAt, p.UpdatedAt)

	service, err := s.Create(ctx, olma, vali, Input{Kind: KindService, Name: "Yetkazish", Price: ptr("50000")})
	require.NoError(t, err)
	assert.Equal(t, KindService, service.Kind)
	assert.Nil(t, service.Unit)
	assert.Equal(t, ptr("50000.00"), service.Price)
	assert.Nil(t, service.CreatedByName, "a member who goes by no name")

	_, err = s.Create(ctx, olma, ali, product("olma", "dona"))
	refused(t, err, apperr.Conflict, "name_taken", "Bu nomli mahsulot allaqachon bor", "the name is taken among the products, whatever the case")
	_, err = s.Create(ctx, olma, ali, Input{Kind: KindService, Name: "yetkazish"})
	refused(t, err, apperr.Conflict, "name_taken", "Bu nomli xizmat allaqachon bor")
	_, err = s.Create(ctx, olma, ali, Input{Kind: KindService, Name: "Olma"})
	require.NoError(t, err, "a service may have a product's name")
	_, err = s.Create(ctx, olma, ali, Input{Kind: KindProduct, Name: "Nok", Unit: ptr("dona"), SKU: ptr("a-1")})
	refused(t, err, apperr.Conflict, "sku_taken", "Bu artikulli mahsulot allaqachon bor")
	_, err = s.Create(ctx, nok, ali, Input{Kind: KindProduct, Name: "Olma", Unit: ptr("kg"), SKU: ptr("A-1")})
	require.NoError(t, err, "another company has its own names")
	_, err = s.Create(ctx, olma, ali, Input{Kind: KindProduct, Name: "Nok"})
	refused(t, err, apperr.Invalid, "validation_error", "Birlikni tanlang", "the input is checked before anything is written")
}

func TestList(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := addCompany(t, pool, "Olma")
	nokCo := addCompany(t, pool, "Nok")
	nok, err := s.Create(ctx, olma, ali, Input{Kind: KindProduct, Name: "Nok", Unit: ptr("dona"), SKU: ptr("N-1")})
	require.NoError(t, err)
	anor, err := s.Create(ctx, olma, ali, product("anor", "kg"))
	require.NoError(t, err)
	off, err := s.Create(ctx, olma, ali, product("Olma", "kg"))
	require.NoError(t, err)
	_, err = s.SetActive(ctx, olma, off.ID, false)
	require.NoError(t, err)
	_, err = s.Create(ctx, olma, ali, Input{Kind: KindService, Name: "Yetkazish"})
	require.NoError(t, err)
	_, err = s.Create(ctx, nokCo, ali, product("Olma", "kg"))
	require.NoError(t, err)
	ids := func(page Page) []int64 {
		out := make([]int64, 0, len(page.Items))
		for _, p := range page.Items {
			out = append(out, p.ID)
		}
		return out
	}

	page, err := s.List(ctx, olma, ListInput{Page: 1})
	require.NoError(t, err)
	assert.Equal(t, []int64{anor.ID, nok.ID}, ids(page), "the active products by name, whatever the case; the kind is product unless said")
	assert.EqualValues(t, 2, page.Total)
	assert.Equal(t, 1, page.Page)
	assert.Equal(t, PageSize, page.PageSize)
	page, err = s.List(ctx, olma, ListInput{Kind: KindProduct, Status: "inactive", Page: 1})
	require.NoError(t, err)
	assert.Equal(t, []int64{off.ID}, ids(page))
	page, err = s.List(ctx, olma, ListInput{Kind: KindService, Status: "active", Page: 1})
	require.NoError(t, err)
	assert.Len(t, page.Items, 1)
	page, err = s.List(ctx, olma, ListInput{Search: " n-1 ", Page: 1})
	require.NoError(t, err)
	assert.Equal(t, []int64{nok.ID}, ids(page), "a search looks in the SKU too")
	page, err = s.List(ctx, olma, ListInput{Search: "%", Page: 1})
	require.NoError(t, err)
	assert.Empty(t, page.Items, "a search is taken literally")
	page, err = s.List(ctx, olma, ListInput{Page: 2})
	require.NoError(t, err)
	assert.Empty(t, page.Items, "past the last page")
	assert.EqualValues(t, 2, page.Total)

	_, err = s.List(ctx, olma, ListInput{Page: 0})
	refused(t, err, apperr.Invalid, "validation_error", "Sahifa raqami noto'g'ri")
	_, err = s.List(ctx, olma, ListInput{Kind: "thing", Page: 1})
	refused(t, err, apperr.Invalid, "validation_error", "Tur noto'g'ri")
	_, err = s.List(ctx, olma, ListInput{Status: "gone", Page: 1})
	refused(t, err, apperr.Invalid, "validation_error", "Holat noto'g'ri")
}

func TestGet(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := addCompany(t, pool, "Olma")
	nok := addCompany(t, pool, "Nok")
	p, err := s.Create(ctx, olma, ali, product("Olma", "kg"))
	require.NoError(t, err)

	got, err := s.Get(ctx, olma, p.ID)
	require.NoError(t, err)
	assert.Equal(t, p, got)
	_, err = s.Get(ctx, nok, p.ID)
	refused(t, err, apperr.NotFound, "not_found", "Mahsulot topilmadi", "another company's product")
	require.NoError(t, s.Delete(ctx, olma, p.ID))
	_, err = s.Get(ctx, olma, p.ID)
	refused(t, err, apperr.NotFound, "not_found", "Mahsulot topilmadi", "a deleted one")
}

func TestUpdate(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := addCompany(t, pool, "Olma")
	nok := addCompany(t, pool, "Nok")
	p, err := s.Create(ctx, olma, ali, Input{Kind: KindProduct, Name: "Olma", Unit: ptr("kg"), SKU: ptr("A-1"), Price: ptr("100"), Note: ptr("Qizil")})
	require.NoError(t, err)
	_, err = s.Create(ctx, olma, ali, Input{Kind: KindProduct, Name: "Nok", Unit: ptr("dona"), SKU: ptr("N-1")})
	require.NoError(t, err)
	service, err := s.Create(ctx, olma, ali, Input{Kind: KindService, Name: "Yetkazish"})
	require.NoError(t, err)

	updated, err := s.Update(ctx, olma, p.ID, Input{Kind: KindService, Name: " Qizil olma ", Unit: ptr("dona"), SKU: ptr("A-2"), Price: ptr("150.5"), Note: ptr("Yangi")})
	require.NoError(t, err)
	assert.Equal(t, KindProduct, updated.Kind, "the kind stays whatever is sent")
	assert.Equal(t, "Qizil olma", updated.Name)
	assert.Equal(t, ptr("dona"), updated.Unit)
	assert.Equal(t, ptr("A-2"), updated.SKU)
	assert.Equal(t, ptr("150.50"), updated.Price)
	assert.Equal(t, ptr("Yangi"), updated.Note)
	assert.Equal(t, p.CreatedByName, updated.CreatedByName)

	cleared, err := s.Update(ctx, olma, p.ID, product("Olma", "kg"))
	require.NoError(t, err)
	assert.Nil(t, cleared.SKU, "what is not sent is cleared")
	assert.Nil(t, cleared.Price)
	assert.Nil(t, cleared.Note)

	_, err = s.Update(ctx, olma, p.ID, product("nok", "kg"))
	refused(t, err, apperr.Conflict, "name_taken", "Bu nomli mahsulot allaqachon bor")
	_, err = s.Update(ctx, olma, p.ID, Input{Kind: KindProduct, Name: "Olma", Unit: ptr("kg"), SKU: ptr("n-1")})
	refused(t, err, apperr.Conflict, "sku_taken", "Bu artikulli mahsulot allaqachon bor")
	_, err = s.Update(ctx, olma, p.ID, Input{Name: "Olma"})
	refused(t, err, apperr.Invalid, "validation_error", "Birlikni tanlang", "a product is checked as a product")
	_, err = s.Update(ctx, olma, service.ID, Input{Name: "Yetkazish", Unit: ptr("dona")})
	refused(t, err, apperr.Invalid, "validation_error", "Xizmatga birlik berilmaydi", "a service as a service")
	_, err = s.Update(ctx, nok, p.ID, product("Olma", "kg"))
	refused(t, err, apperr.NotFound, "not_found", "Mahsulot topilmadi", "another company's product")
	_, err = s.Update(ctx, olma, p.ID+100, Input{})
	refused(t, err, apperr.NotFound, "not_found", "Mahsulot topilmadi", "the record before its fields")
}

func TestSetActive(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := addCompany(t, pool, "Olma")
	p, err := s.Create(ctx, olma, ali, product("Olma", "kg"))
	require.NoError(t, err)

	off, err := s.SetActive(ctx, olma, p.ID, false)
	require.NoError(t, err)
	assert.False(t, off.Active)
	on, err := s.SetActive(ctx, olma, p.ID, true)
	require.NoError(t, err)
	assert.True(t, on.Active)
	_, err = s.SetActive(ctx, olma, p.ID+1, false)
	refused(t, err, apperr.NotFound, "not_found", "Mahsulot topilmadi")
	_, err = s.Create(ctx, olma, ali, product("olma", "dona"))
	refused(t, err, apperr.Conflict, "name_taken", "Bu nomli mahsulot allaqachon bor", "an inactive row keeps its name")
}

func TestDelete(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := addCompany(t, pool, "Olma")
	nok := addCompany(t, pool, "Nok")
	p, err := s.Create(ctx, olma, ali, Input{Kind: KindProduct, Name: "Olma", Unit: ptr("kg"), SKU: ptr("A-1")})
	require.NoError(t, err)

	refused(t, s.Delete(ctx, nok, p.ID), apperr.NotFound, "not_found", "Mahsulot topilmadi", "another company's product")
	require.NoError(t, s.Delete(ctx, olma, p.ID))
	refused(t, s.Delete(ctx, olma, p.ID), apperr.NotFound, "not_found", "Mahsulot topilmadi", "deleted already")
	_, err = s.Create(ctx, olma, ali, Input{Kind: KindProduct, Name: "Olma", Unit: ptr("kg"), SKU: ptr("A-1")})
	require.NoError(t, err, "the name and the SKU are free again")
}

func TestANameMayBeAHundredAndTwentyCharactersLong(t *testing.T) {
	s, pool := newService(t)
	olma := addCompany(t, pool, "Olma")
	long := strings.Repeat("a", 120)

	p, err := s.Create(t.Context(), olma, ali, product(long, "kg"))

	require.NoError(t, err)
	assert.Equal(t, long, p.Name)
}

// holdCompany holds the company the way a write of its customers does,
// until release is called: a write made meanwhile has to wait.
func holdCompany(t *testing.T, pool *pgxpool.Pool, companyID int64) (release func()) {
	t.Helper()
	tx, err := pool.Begin(t.Context())
	require.NoError(t, err)
	t.Cleanup(func() { _ = tx.Rollback(context.Background()) })
	_, err = tx.Exec(t.Context(), "SELECT id FROM companies WHERE id = $1 FOR NO KEY UPDATE", companyID)
	require.NoError(t, err)
	return func() { require.NoError(t, tx.Commit(t.Context())) }
}

// waits asserts that the write waits while the company is held, and goes on
// once it is free.
func waits(t *testing.T, pool *pgxpool.Pool, companyID int64, write func() error) {
	t.Helper()
	release := holdCompany(t, pool, companyID)
	done := make(chan error, 1)
	go func() { done <- write() }()
	pgtest.WaitForLockWait(t, pool)
	select {
	case err := <-done:
		t.Fatalf("the write did not wait: %v", err)
	default:
	}
	release()
	require.NoError(t, <-done, "the write goes on once the company is free")
}

// The writes of a company's catalog take turns with each other and with the
// writes of its customers and tasks (the same lock), so what one of them
// checks cannot change under it.
func TestAWriteWaitsForAnotherWriteOfTheSameCompany(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := addCompany(t, pool, "Olma")
	p, err := s.Create(ctx, olma, ali, product("Olma", "kg"))
	require.NoError(t, err)

	waits(t, pool, olma, func() error { _, err := s.Create(ctx, olma, ali, product("Nok", "dona")); return err })
	waits(t, pool, olma, func() error { _, err := s.Update(ctx, olma, p.ID, product("Olma", "dona")); return err })
	waits(t, pool, olma, func() error { _, err := s.SetActive(ctx, olma, p.ID, false); return err })
	waits(t, pool, olma, func() error { return s.Delete(ctx, olma, p.ID) })
}
