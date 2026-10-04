package db_test

import (
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

func TestCreateCustomerDropdown(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	c := createCompany(t, q, "Olma", today(t, pool))

	d, err := q.CreateCustomerDropdown(ctx, gen.CreateCustomerDropdownParams{CompanyID: c.ID, Name: "Manba"})

	require.NoError(t, err)
	assert.NotZero(t, d.ID)
	assert.Equal(t, c.ID, d.CompanyID)
	assert.Equal(t, "Manba", d.Name)
	assert.False(t, d.CreatedAt.IsZero())
	assert.Nil(t, d.DeletedAt)
	_, err = q.CreateCustomerDropdown(ctx, gen.CreateCustomerDropdownParams{CompanyID: c.ID, Name: "MANBA"})
	assert.Equal(t, "23505", sqlState(err), "the name is taken in the company") // unique_violation
}

func createDropdown(t *testing.T, q *gen.Queries, companyID int64, name string) gen.CustomerDropdown {
	t.Helper()
	d, err := q.CreateCustomerDropdown(t.Context(), gen.CreateCustomerDropdownParams{CompanyID: companyID, Name: name})
	require.NoError(t, err)
	return d
}

func TestListCustomerDropdowns(t *testing.T) {
	q, pool := setup(t)
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	manba := createDropdown(t, q, olma.ID, "Manba")
	holat := createDropdown(t, q, olma.ID, "Holat")
	eski := createDropdown(t, q, olma.ID, "Eski")
	createDropdown(t, q, nok.ID, "Begona")
	mustExec(t, pool, "UPDATE customer_dropdowns SET deleted_at = now() WHERE id = $1", eski.ID)

	list, err := q.ListCustomerDropdowns(t.Context(), olma.ID)

	require.NoError(t, err)
	require.Len(t, list, 2, "the company's own, without the deleted one")
	assert.Equal(t, []int64{manba.ID, holat.ID}, []int64{list[0].ID, list[1].ID}, "in the order they were made")
}

func TestGetCustomerDropdown(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	manba := createDropdown(t, q, olma.ID, "Manba")

	d, err := q.GetCustomerDropdown(ctx, gen.GetCustomerDropdownParams{ID: manba.ID, CompanyID: olma.ID})
	require.NoError(t, err)
	assert.Equal(t, "Manba", d.Name)

	_, err = q.GetCustomerDropdown(ctx, gen.GetCustomerDropdownParams{ID: manba.ID, CompanyID: nok.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's dropdown")
	mustExec(t, pool, "UPDATE customer_dropdowns SET deleted_at = now() WHERE id = $1", manba.ID)
	_, err = q.GetCustomerDropdown(ctx, gen.GetCustomerDropdownParams{ID: manba.ID, CompanyID: olma.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "a deleted dropdown")
}

func TestRenameCustomerDropdown(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	manba := createDropdown(t, q, olma.ID, "Manba")
	createDropdown(t, q, olma.ID, "Holat")

	d, err := q.RenameCustomerDropdown(ctx, gen.RenameCustomerDropdownParams{ID: manba.ID, CompanyID: olma.ID, Name: "Qayerdan"})
	require.NoError(t, err)
	assert.Equal(t, "Qayerdan", d.Name)

	_, err = q.RenameCustomerDropdown(ctx, gen.RenameCustomerDropdownParams{ID: manba.ID, CompanyID: olma.ID, Name: "holat"})
	assert.Equal(t, "23505", sqlState(err), "another dropdown's name")
	_, err = q.RenameCustomerDropdown(ctx, gen.RenameCustomerDropdownParams{ID: manba.ID, CompanyID: nok.ID, Name: "Begona"})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's dropdown")
}

func TestDeleteCustomerDropdown(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	manba := createDropdown(t, q, olma.ID, "Manba")

	_, err := q.DeleteCustomerDropdown(ctx, gen.DeleteCustomerDropdownParams{ID: manba.ID, CompanyID: nok.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's dropdown")
	id, err := q.DeleteCustomerDropdown(ctx, gen.DeleteCustomerDropdownParams{ID: manba.ID, CompanyID: olma.ID})
	require.NoError(t, err)
	assert.Equal(t, manba.ID, id)

	var hidden bool
	require.NoError(t, pool.QueryRow(ctx, "SELECT deleted_at IS NOT NULL FROM customer_dropdowns WHERE id = $1", manba.ID).Scan(&hidden))
	assert.True(t, hidden, "the row stays, marked deleted")
	_, err = q.DeleteCustomerDropdown(ctx, gen.DeleteCustomerDropdownParams{ID: manba.ID, CompanyID: olma.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "deleted already")
}

func addOption(t *testing.T, q *gen.Queries, companyID, dropdownID int64, label string) gen.CustomerDropdownOption {
	t.Helper()
	o, err := q.AddCustomerDropdownOption(t.Context(),
		gen.AddCustomerDropdownOptionParams{CompanyID: companyID, DropdownID: dropdownID, Label: label})
	require.NoError(t, err)
	return o
}

func TestAddCustomerDropdownOption(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	manba := createDropdown(t, q, olma.ID, "Manba")

	first, err := q.AddCustomerDropdownOption(ctx,
		gen.AddCustomerDropdownOptionParams{CompanyID: olma.ID, DropdownID: manba.ID, Label: "Instagram"})
	require.NoError(t, err)
	assert.Equal(t, manba.ID, first.DropdownID)
	assert.Equal(t, "Instagram", first.Label)
	assert.EqualValues(t, 1, first.Position)
	assert.True(t, first.IsActive)
	second := addOption(t, q, olma.ID, manba.ID, "LinkedIn")
	assert.EqualValues(t, 2, second.Position, "a new option goes last")

	_, err = q.AddCustomerDropdownOption(ctx,
		gen.AddCustomerDropdownOptionParams{CompanyID: olma.ID, DropdownID: manba.ID, Label: "instagram"})
	assert.Equal(t, "23505", sqlState(err), "the option is in the dropdown already")
	_, err = q.AddCustomerDropdownOption(ctx,
		gen.AddCustomerDropdownOptionParams{CompanyID: nok.ID, DropdownID: manba.ID, Label: "Begona"})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's dropdown")
}

func TestListCustomerDropdownOptions(t *testing.T) {
	q, pool := setup(t)
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	manba := createDropdown(t, q, olma.ID, "Manba")
	holat := createDropdown(t, q, olma.ID, "Holat")
	eski := createDropdown(t, q, olma.ID, "Eski")
	instagram := addOption(t, q, olma.ID, manba.ID, "Instagram")
	linkedin := addOption(t, q, olma.ID, manba.ID, "LinkedIn")
	youtube := addOption(t, q, olma.ID, manba.ID, "YouTube")
	yangi := addOption(t, q, olma.ID, holat.ID, "Yangi")
	addOption(t, q, olma.ID, eski.ID, "Eski variant")
	addOption(t, q, nok.ID, createDropdown(t, q, nok.ID, "Begona").ID, "Begona variant")
	mustExec(t, pool, "UPDATE customer_dropdown_options SET position = 0 WHERE id = $1", youtube.ID)
	mustExec(t, pool, "UPDATE customer_dropdown_options SET deleted_at = now() WHERE id = $1", linkedin.ID)
	mustExec(t, pool, "UPDATE customer_dropdowns SET deleted_at = now() WHERE id = $1", eski.ID)

	list, err := q.ListCustomerDropdownOptions(t.Context(), olma.ID)

	require.NoError(t, err)
	ids := make([]int64, 0, len(list))
	for _, o := range list {
		ids = append(ids, o.ID)
	}
	assert.Equal(t, []int64{youtube.ID, instagram.ID, yangi.ID}, ids,
		"each of the company's dropdowns' options in their order, without the deleted")
}

func TestUpdateCustomerDropdownOption(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	manba := createDropdown(t, q, olma.ID, "Manba")
	holat := createDropdown(t, q, olma.ID, "Holat")
	instagram := addOption(t, q, olma.ID, manba.ID, "Instagram")
	addOption(t, q, olma.ID, manba.ID, "LinkedIn")
	its := gen.UpdateCustomerDropdownOptionParams{CompanyID: olma.ID, DropdownID: manba.ID, ID: instagram.ID}

	renamed := its
	renamed.Label = ptr("Insta")
	o, err := q.UpdateCustomerDropdownOption(ctx, renamed)
	require.NoError(t, err)
	assert.Equal(t, "Insta", o.Label)
	assert.True(t, o.IsActive, "what is not given stays")

	off := its
	off.IsActive = ptr(false)
	o, err = q.UpdateCustomerDropdownOption(ctx, off)
	require.NoError(t, err)
	assert.False(t, o.IsActive)
	assert.Equal(t, "Insta", o.Label, "what is not given stays")

	taken := its
	taken.Label = ptr("linkedin")
	_, err = q.UpdateCustomerDropdownOption(ctx, taken)
	assert.Equal(t, "23505", sqlState(err), "another option's name")

	begona := renamed
	begona.CompanyID = nok.ID
	_, err = q.UpdateCustomerDropdownOption(ctx, begona)
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's dropdown")
	elsewhere := renamed
	elsewhere.DropdownID = holat.ID
	_, err = q.UpdateCustomerDropdownOption(ctx, elsewhere)
	assert.ErrorIs(t, err, pgx.ErrNoRows, "an option of another dropdown")
	mustExec(t, pool, "UPDATE customer_dropdown_options SET deleted_at = now() WHERE id = $1", instagram.ID)
	_, err = q.UpdateCustomerDropdownOption(ctx, renamed)
	assert.ErrorIs(t, err, pgx.ErrNoRows, "a deleted option")
}
