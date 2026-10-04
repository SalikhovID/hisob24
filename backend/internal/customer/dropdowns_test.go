package customer

import (
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
)

func TestCreateDropdown(t *testing.T) {
	s, pool := newService(t)
	olma := addCompany(t, pool, "Olma")

	d, err := s.CreateDropdown(t.Context(), olma, "  Manba ")

	require.NoError(t, err)
	assert.NotZero(t, d.ID)
	assert.Equal(t, "Manba", d.Name, "the name is trimmed")
	assert.Equal(t, []Option{}, d.Options, "a new dropdown has no options")
	var company int64
	require.NoError(t, pool.QueryRow(t.Context(), "SELECT company_id FROM customer_dropdowns WHERE id = $1", d.ID).Scan(&company))
	assert.Equal(t, olma, company)
}

func TestCreateDropdownRefusals(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma, nok := addCompany(t, pool, "Olma"), addCompany(t, pool, "Nok")
	_, err := s.CreateDropdown(ctx, olma, "Manba")
	require.NoError(t, err)

	_, err = s.CreateDropdown(ctx, olma, "   ")
	refused(t, err, apperr.Invalid, "validation_error", "Nomni kiriting", "no name")
	_, err = s.CreateDropdown(ctx, olma, strings.Repeat("ў", 61))
	refused(t, err, apperr.Invalid, "validation_error", "Nom 60 belgidan oshmasin", "a name too long")
	_, err = s.CreateDropdown(ctx, olma, strings.Repeat("ў", 60))
	assert.NoError(t, err, "sixty characters, counted as characters and not as bytes")
	_, err = s.CreateDropdown(ctx, olma, " MANBA ")
	refused(t, err, apperr.Conflict, "name_taken", "Bu nomli dropdown allaqachon bor", "the name in another case")
	_, err = s.CreateDropdown(ctx, nok, "Manba")
	assert.NoError(t, err, "another company may take the name")

	var dropdowns int
	require.NoError(t, pool.QueryRow(ctx, "SELECT count(*) FROM customer_dropdowns WHERE company_id = $1", olma).Scan(&dropdowns))
	assert.Equal(t, 2, dropdowns, "a refusal adds nothing")
}

func mustDropdown(t *testing.T, s *Service, companyID int64, name string) Dropdown {
	t.Helper()
	d, err := s.CreateDropdown(t.Context(), companyID, name)
	require.NoError(t, err)
	return d
}

// optionRow inserts an option as it would stand after the owner's changes:
// at a place of its own, on or off.
func optionRow(t *testing.T, pool *pgxpool.Pool, dropdownID int64, label string, position int, active bool) int64 {
	t.Helper()
	var id int64
	require.NoError(t, pool.QueryRow(t.Context(), `INSERT INTO customer_dropdown_options (dropdown_id, label, position, is_active)
		VALUES ($1, $2, $3, $4) RETURNING id`, dropdownID, label, position, active).Scan(&id))
	return id
}

func TestDropdowns(t *testing.T) {
	s, pool := newService(t)
	olma, nok := addCompany(t, pool, "Olma"), addCompany(t, pool, "Nok")
	manba := mustDropdown(t, s, olma, "Manba")
	holat := mustDropdown(t, s, olma, "Holat")
	mustDropdown(t, s, nok, "Begona")
	instagram := optionRow(t, pool, manba.ID, "Instagram", 2, true)
	linkedin := optionRow(t, pool, manba.ID, "LinkedIn", 1, false)

	list, err := s.Dropdowns(t.Context(), olma)

	require.NoError(t, err)
	assert.Equal(t, []Dropdown{
		{ID: manba.ID, Name: "Manba", Options: []Option{
			{ID: linkedin, Label: "LinkedIn", Active: false},
			{ID: instagram, Label: "Instagram", Active: true},
		}},
		{ID: holat.ID, Name: "Holat", Options: []Option{}},
	}, list, "the company's dropdowns as they were made, each with its options in their order")
}

func TestRenameDropdown(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma, nok := addCompany(t, pool, "Olma"), addCompany(t, pool, "Nok")
	manba := mustDropdown(t, s, olma, "Manba")
	mustDropdown(t, s, olma, "Holat")
	instagram := optionRow(t, pool, manba.ID, "Instagram", 1, true)

	d, err := s.RenameDropdown(ctx, olma, manba.ID, " Qayerdan ")

	require.NoError(t, err)
	assert.Equal(t, Dropdown{ID: manba.ID, Name: "Qayerdan", Options: []Option{{ID: instagram, Label: "Instagram", Active: true}}}, d,
		"the dropdown under its new name, with its options")

	const notFound = "Dropdown topilmadi"
	_, err = s.RenameDropdown(ctx, olma, manba.ID, " ")
	refused(t, err, apperr.Invalid, "validation_error", "Nomni kiriting", "no name")
	_, err = s.RenameDropdown(ctx, olma, manba.ID, "HOLAT")
	refused(t, err, apperr.Conflict, "name_taken", "Bu nomli dropdown allaqachon bor", "another dropdown's name")
	_, err = s.RenameDropdown(ctx, nok, manba.ID, "Begona")
	refused(t, err, apperr.NotFound, "not_found", notFound, "another company's dropdown")
	_, err = s.RenameDropdown(ctx, olma, manba.ID+100, "Yo'q")
	refused(t, err, apperr.NotFound, "not_found", notFound, "no such dropdown")
	_, err = s.RenameDropdown(ctx, olma, manba.ID, "qayerdan")
	assert.NoError(t, err, "its own name in another case is not taken")
}

func TestAddOption(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma, nok := addCompany(t, pool, "Olma"), addCompany(t, pool, "Nok")
	manba := mustDropdown(t, s, olma, "Manba")

	first, err := s.AddOption(ctx, olma, manba.ID, " Instagram ")

	require.NoError(t, err)
	assert.NotZero(t, first.ID)
	assert.Equal(t, "Instagram", first.Label, "the name is trimmed")
	assert.True(t, first.Active, "a new option is offered")
	second, err := s.AddOption(ctx, olma, manba.ID, "LinkedIn")
	require.NoError(t, err)
	list, err := s.Dropdowns(ctx, olma)
	require.NoError(t, err)
	assert.Equal(t, []Option{first, second}, list[0].Options, "a new option goes last")

	_, err = s.AddOption(ctx, olma, manba.ID, " ")
	refused(t, err, apperr.Invalid, "validation_error", "Nomni kiriting", "no name")
	_, err = s.AddOption(ctx, olma, manba.ID, "INSTAGRAM")
	refused(t, err, apperr.Conflict, "name_taken", "Bu variant allaqachon bor", "the option in another case")
	_, err = s.AddOption(ctx, nok, manba.ID, "Begona")
	refused(t, err, apperr.NotFound, "not_found", "Dropdown topilmadi", "another company's dropdown")
}

func mustOption(t *testing.T, s *Service, companyID, dropdownID int64, label string) Option {
	t.Helper()
	o, err := s.AddOption(t.Context(), companyID, dropdownID, label)
	require.NoError(t, err)
	return o
}

func TestUpdateOption(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma, nok := addCompany(t, pool, "Olma"), addCompany(t, pool, "Nok")
	manba := mustDropdown(t, s, olma, "Manba")
	holat := mustDropdown(t, s, olma, "Holat")
	instagram := mustOption(t, s, olma, manba.ID, "Instagram")
	mustOption(t, s, olma, manba.ID, "LinkedIn")

	o, err := s.UpdateOption(ctx, olma, manba.ID, instagram.ID, OptionPatch{Label: ptr(" Insta ")})
	require.NoError(t, err)
	assert.Equal(t, Option{ID: instagram.ID, Label: "Insta", Active: true}, o, "renamed, still offered")

	o, err = s.UpdateOption(ctx, olma, manba.ID, instagram.ID, OptionPatch{Active: ptr(false)})
	require.NoError(t, err)
	assert.Equal(t, Option{ID: instagram.ID, Label: "Insta", Active: false}, o, "turned off, under the same name")
	o, err = s.UpdateOption(ctx, olma, manba.ID, instagram.ID, OptionPatch{Active: ptr(true)})
	require.NoError(t, err)
	assert.True(t, o.Active, "and on again")

	const notFound = "Variant topilmadi"
	_, err = s.UpdateOption(ctx, olma, manba.ID, instagram.ID, OptionPatch{Label: ptr(" ")})
	refused(t, err, apperr.Invalid, "validation_error", "Nomni kiriting", "no name")
	_, err = s.UpdateOption(ctx, olma, manba.ID, instagram.ID, OptionPatch{Label: ptr("linkedin")})
	refused(t, err, apperr.Conflict, "name_taken", "Bu variant allaqachon bor", "another option's name")
	_, err = s.UpdateOption(ctx, nok, manba.ID, instagram.ID, OptionPatch{Label: ptr("Begona")})
	refused(t, err, apperr.NotFound, "not_found", notFound, "another company's dropdown")
	_, err = s.UpdateOption(ctx, olma, holat.ID, instagram.ID, OptionPatch{Label: ptr("Begona")})
	refused(t, err, apperr.NotFound, "not_found", notFound, "an option of another dropdown")
}

func TestDeleteOption(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma, nok := addCompany(t, pool, "Olma"), addCompany(t, pool, "Nok")
	manba := mustDropdown(t, s, olma, "Manba")
	instagram := mustOption(t, s, olma, manba.ID, "Instagram")
	linkedin := mustOption(t, s, olma, manba.ID, "LinkedIn")

	require.NoError(t, s.DeleteOption(ctx, olma, manba.ID, instagram.ID))

	list, err := s.Dropdowns(ctx, olma)
	require.NoError(t, err)
	assert.Equal(t, []Option{linkedin}, list[0].Options, "the option is gone from the dropdown")
	var rows int
	require.NoError(t, pool.QueryRow(ctx, "SELECT count(*) FROM customer_dropdown_options WHERE dropdown_id = $1", manba.ID).Scan(&rows))
	assert.Equal(t, 2, rows, "nothing leaves the database")
	again, err := s.AddOption(ctx, olma, manba.ID, "Instagram")
	require.NoError(t, err, "the deleted option's name is free again")
	assert.NotEqual(t, instagram.ID, again.ID)

	const notFound = "Variant topilmadi"
	refused(t, s.DeleteOption(ctx, olma, manba.ID, instagram.ID), apperr.NotFound, "not_found", notFound, "deleted already")
	refused(t, s.DeleteOption(ctx, nok, manba.ID, linkedin.ID), apperr.NotFound, "not_found", notFound, "another company's dropdown")
}

func TestOrderOptions(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma, nok := addCompany(t, pool, "Olma"), addCompany(t, pool, "Nok")
	manba := mustDropdown(t, s, olma, "Manba")
	instagram := mustOption(t, s, olma, manba.ID, "Instagram")
	linkedin := mustOption(t, s, olma, manba.ID, "LinkedIn")
	youtube := mustOption(t, s, olma, manba.ID, "YouTube")
	labels := func() []string {
		list, err := s.Dropdowns(ctx, olma)
		require.NoError(t, err)
		names := []string{}
		for _, o := range list[0].Options {
			names = append(names, o.Label)
		}
		return names
	}

	require.NoError(t, s.OrderOptions(ctx, olma, manba.ID, []int64{youtube.ID, instagram.ID, linkedin.ID}))

	assert.Equal(t, []string{"YouTube", "Instagram", "LinkedIn"}, labels())

	const changed = "Ro'yxat o'zgargan. Sahifani yangilang"
	for about, ids := range map[string][]int64{
		"an option is missing":                   {instagram.ID, linkedin.ID},
		"an option that is not the dropdown's":   {instagram.ID, linkedin.ID, youtube.ID + 100},
		"an option named twice":                  {instagram.ID, instagram.ID, linkedin.ID},
		"an option more than the dropdown holds": {instagram.ID, linkedin.ID, youtube.ID, youtube.ID + 100},
	} {
		refused(t, s.OrderOptions(ctx, olma, manba.ID, ids), apperr.Conflict, "order_changed", changed, about)
	}
	refused(t, s.OrderOptions(ctx, nok, manba.ID, []int64{instagram.ID, linkedin.ID, youtube.ID}),
		apperr.NotFound, "not_found", "Dropdown topilmadi", "another company's dropdown")
	assert.Equal(t, []string{"YouTube", "Instagram", "LinkedIn"}, labels(), "a refusal moves nothing")

	mustOption(t, s, olma, manba.ID, "Tavsiya")
	assert.Equal(t, []string{"YouTube", "Instagram", "LinkedIn", "Tavsiya"}, labels(), "a new option still goes last")
}
