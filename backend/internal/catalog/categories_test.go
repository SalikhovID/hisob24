package catalog

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
)

// categoryNames is the names of the categories, in order.
func categoryNames(list []Category) []string {
	names := []string{}
	for _, c := range list {
		names = append(names, c.Name)
	}
	return names
}

// A company's product categories (logic/products.md, 3.4): a name trimmed,
// 1–60 characters, one category's in the company whatever the case; a new
// one goes last.
func TestCreateCategory(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := addCompany(t, pool, "Olma")
	nok := addCompany(t, pool, "Nok")

	drinks, err := s.CreateCategory(ctx, olma, " Ichimliklar ")
	require.NoError(t, err)
	assert.Positive(t, drinks.ID)
	assert.Equal(t, "Ichimliklar", drinks.Name, "trimmed")
	_, err = s.CreateCategory(ctx, olma, "Shirinliklar")
	require.NoError(t, err)
	_, err = s.CreateCategory(ctx, nok, "Ichimliklar")
	require.NoError(t, err, "another company has its own names")

	for name, tc := range map[string]struct {
		name    string
		kind    apperr.Kind
		code    string
		message string
	}{
		"no name":      {" ", apperr.Invalid, "validation_error", "Nomni kiriting"},
		"a long name":  {strings.Repeat("a", 61), apperr.Invalid, "validation_error", "Nom 60 belgidan oshmasin"},
		"a taken name": {"ICHIMLIKLAR", apperr.Conflict, "name_taken", "Bu nomli kategoriya allaqachon bor"},
	} {
		_, err := s.CreateCategory(ctx, olma, tc.name)
		refused(t, err, tc.kind, tc.code, tc.message, name)
	}

	list, err := s.Categories(ctx, olma)
	require.NoError(t, err)
	assert.Equal(t, []string{"Ichimliklar", "Shirinliklar"}, categoryNames(list), "the company's own, a new one last")
}

// A category is renamed under the same rules; another company's is not
// found.
func TestRenameCategory(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := addCompany(t, pool, "Olma")
	nok := addCompany(t, pool, "Nok")
	drinks, err := s.CreateCategory(ctx, olma, "Ichimliklar")
	require.NoError(t, err)
	_, err = s.CreateCategory(ctx, olma, "Shirinliklar")
	require.NoError(t, err)

	renamed, err := s.RenameCategory(ctx, olma, drinks.ID, " Suvlar ")
	require.NoError(t, err)
	assert.Equal(t, Category{ID: drinks.ID, Name: "Suvlar"}, renamed)
	_, err = s.RenameCategory(ctx, olma, drinks.ID, "shirinliklar")
	refused(t, err, apperr.Conflict, "name_taken", "Bu nomli kategoriya allaqachon bor")
	_, err = s.RenameCategory(ctx, olma, drinks.ID, " ")
	refused(t, err, apperr.Invalid, "validation_error", "Nomni kiriting")
	_, err = s.RenameCategory(ctx, nok, drinks.ID, "Suv")
	refused(t, err, apperr.NotFound, "not_found", "Kategoriya topilmadi", "another company's")
}

// A category its live products are under stays (409, with how many: the
// inactive ones count, the deleted do not); an empty one is deleted, and
// its name is free again.
func TestDeleteCategory(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := addCompany(t, pool, "Olma")
	nok := addCompany(t, pool, "Nok")
	drinks, err := s.CreateCategory(ctx, olma, "Ichimliklar")
	require.NoError(t, err)
	file := func(name string, active, deleted bool) {
		_, err := pool.Exec(ctx, `INSERT INTO products (company_id, kind, name, unit, is_active, category_id, created_by, deleted_at)
			VALUES ($1, 'product', $2, 'dona', $3, $4, $5, CASE WHEN $6 THEN now() END)`, olma, name, active, drinks.ID, ali, deleted)
		require.NoError(t, err)
	}
	file("Kola", true, false)
	file("Fanta", false, false)
	file("Eski", true, true)

	err = s.DeleteCategory(ctx, olma, drinks.ID)
	refused(t, err, apperr.Conflict, "category_in_use", "Bu kategoriyada 2 ta mahsulot bor", "the live products, the inactive one too")
	err = s.DeleteCategory(ctx, nok, drinks.ID)
	refused(t, err, apperr.NotFound, "not_found", "Kategoriya topilmadi", "another company's")

	_, err = pool.Exec(ctx, "UPDATE products SET category_id = NULL WHERE company_id = $1 AND deleted_at IS NULL", olma)
	require.NoError(t, err)
	require.NoError(t, s.DeleteCategory(ctx, olma, drinks.ID), "one the deleted products alone are under")
	list, err := s.Categories(ctx, olma)
	require.NoError(t, err)
	assert.Empty(t, list, "gone")
	err = s.DeleteCategory(ctx, olma, drinks.ID)
	refused(t, err, apperr.NotFound, "not_found", "Kategoriya topilmadi", "deleted already")
	_, err = s.RenameCategory(ctx, olma, drinks.ID, "Suv")
	refused(t, err, apperr.NotFound, "not_found", "Kategoriya topilmadi", "a deleted one is not found")
	_, err = s.CreateCategory(ctx, olma, "Ichimliklar")
	assert.NoError(t, err, "its name is free again")
}

// The categories go in the order given, which names each live one once and
// nothing else (409 order_changed otherwise: the list changed elsewhere).
func TestOrderCategories(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := addCompany(t, pool, "Olma")
	nok := addCompany(t, pool, "Nok")
	add := func(companyID int64, name string) int64 {
		c, err := s.CreateCategory(ctx, companyID, name)
		require.NoError(t, err)
		return c.ID
	}
	drinks := add(olma, "Ichimliklar")
	sweets := add(olma, "Shirinliklar")
	home := add(olma, "Xo'jalik")
	other := add(nok, "Boshqa")
	names := func() []string {
		list, err := s.Categories(ctx, olma)
		require.NoError(t, err)
		return categoryNames(list)
	}

	require.NoError(t, s.OrderCategories(ctx, olma, []int64{home, drinks, sweets}))
	assert.Equal(t, []string{"Xo'jalik", "Ichimliklar", "Shirinliklar"}, names())

	for name, ids := range map[string][]int64{
		"one left out":      {home, drinks},
		"one twice":         {home, drinks, drinks},
		"another company's": {home, drinks, other},
		"one more":          {home, drinks, sweets, other},
	} {
		err := s.OrderCategories(ctx, olma, ids)
		refused(t, err, apperr.Conflict, "order_changed", "Ro'yxat o'zgargan. Sahifani yangilang", name)
	}
	assert.Equal(t, []string{"Xo'jalik", "Ichimliklar", "Shirinliklar"}, names(), "a refused order changes nothing")
}

// A product is entered and edited with a category of its company, or with
// none, and carries the category's name as it is now (logic/products.md,
// 3.4).
func TestAProductIsFiledUnderACategory(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := newShop(t, pool, "Olma")
	drinks, err := s.CreateCategory(ctx, olma.company, "Ichimliklar")
	require.NoError(t, err)
	sweets, err := s.CreateCategory(ctx, olma.company, "Shirinliklar")
	require.NoError(t, err)
	filed := func(name string, category *int64) Input {
		in := product(name, "dona")
		in.CategoryID = category
		return in
	}

	cola, err := s.Create(ctx, olma.scope(), ali, filed("Kola", &drinks.ID))
	require.NoError(t, err)
	assert.Equal(t, &drinks.ID, cola.CategoryID)
	assert.Equal(t, ptr("Ichimliklar"), cola.CategoryName, "with its category's name")
	cake, err := s.Create(ctx, olma.scope(), ali, filed("Tort", nil))
	require.NoError(t, err)
	assert.Nil(t, cake.CategoryID, "a category is not needed")
	assert.Nil(t, cake.CategoryName)

	moved, err := s.Update(ctx, olma.scope(), cake.ID, filed("Tort", &sweets.ID))
	require.NoError(t, err)
	assert.Equal(t, ptr("Shirinliklar"), moved.CategoryName, "an edit files it")
	cleared, err := s.Update(ctx, olma.scope(), cola.ID, filed("Kola", nil))
	require.NoError(t, err)
	assert.Nil(t, cleared.CategoryID, "and an edit with none takes it out")

	_, err = s.RenameCategory(ctx, olma.company, sweets.ID, "Desertlar")
	require.NoError(t, err)
	got, err := s.Get(ctx, olma.scope(), cake.ID)
	require.NoError(t, err)
	assert.Equal(t, ptr("Desertlar"), got.CategoryName, "the category's name as it is now")
	page, err := s.List(ctx, olma.scope(), ListInput{Page: 1})
	require.NoError(t, err)
	listed := map[string]*string{}
	for _, p := range page.Items {
		listed[p.Name] = p.CategoryName
	}
	assert.Equal(t, map[string]*string{"Kola": nil, "Tort": ptr("Desertlar")}, listed, "the list carries it too")
}

// A product is filed under a live category of its own company alone: any
// other is refused, and nothing is written (logic/products.md, section 4).
func TestAProductIsFiledUnderALiveCategoryOfItsCompany(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := newShop(t, pool, "Olma")
	nok := newShop(t, pool, "Nok")
	theirs, err := s.CreateCategory(ctx, nok.company, "Ichimliklar")
	require.NoError(t, err)
	gone, err := s.CreateCategory(ctx, olma.company, "Eski")
	require.NoError(t, err)
	require.NoError(t, s.DeleteCategory(ctx, olma.company, gone.ID))
	cola, err := s.Create(ctx, olma.scope(), ali, product("Kola", "dona"))
	require.NoError(t, err)

	for name, id := range map[string]int64{"another company's": theirs.ID, "a deleted one": gone.ID, "none such": 999999} {
		in := product("Fanta", "dona")
		in.CategoryID = &id
		_, err := s.Create(ctx, olma.scope(), ali, in)
		refused(t, err, apperr.Invalid, "validation_error", "Kategoriya noto'g'ri", name)
		in.Name = "Kola"
		_, err = s.Update(ctx, olma.scope(), cola.ID, in)
		refused(t, err, apperr.Invalid, "validation_error", "Kategoriya noto'g'ri", name)
	}
	page, err := s.List(ctx, olma.scope(), ListInput{Page: 1})
	require.NoError(t, err)
	require.Len(t, page.Items, 1, "nothing entered")
	assert.Nil(t, page.Items[0].CategoryID, "nor filed")
}
