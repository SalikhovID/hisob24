package access_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/access"
	"github.com/SalikhovID/hisob24/backend/internal/apperr"
)

func TestAllHasFortyTwoPermissionsInOrder(t *testing.T) {
	t.Parallel()
	require.Len(t, access.All, 42)
	assert.Equal(t, access.CustomersView, access.All[0])
	assert.Equal(t, access.ProductsView, access.All[10], "the warehouse sections come after the tasks")
	assert.Equal(t, access.PurchasesDelete, access.All[21])
	assert.Equal(t, access.SalesView, access.All[22], "the sales, the stock documents and the finance come after the purchases")
	assert.Equal(t, access.StockView, access.All[26])
	assert.Equal(t, access.FinanceDelete, access.All[33])
	assert.Equal(t, access.EmployeesView, access.All[34])
	assert.Equal(t, access.SettingsDelete, access.All[41])
	seen := map[access.Permission]bool{}
	for _, p := range access.All {
		assert.False(t, seen[p], "%s twice", p)
		seen[p] = true
	}
}

func TestDefaultIsEverythingButTheHistoryTheEmployeesAndTheSettings(t *testing.T) {
	t.Parallel()
	assert.Equal(t, []access.Permission{
		"customers.view", "customers.create", "customers.edit", "customers.delete",
		"tasks.view", "tasks.create", "tasks.edit", "tasks.delete",
		"products.view", "products.create", "products.edit", "products.delete",
		"suppliers.view", "suppliers.create", "suppliers.edit", "suppliers.delete",
		"purchases.view", "purchases.create", "purchases.edit", "purchases.delete",
		"sales.view", "sales.create", "sales.edit", "sales.delete",
		"stock.view", "stock.create", "stock.edit", "stock.delete",
		"finance.view", "finance.create", "finance.edit", "finance.delete",
	}, access.Default)
}

func TestParse(t *testing.T) {
	t.Parallel()
	for name, tc := range map[string]struct {
		raw  []string
		want []access.Permission
		err  string
	}{
		"a section with its view":              {[]string{"customers.view", "customers.create"}, []access.Permission{"customers.view", "customers.create"}, ""},
		"in the catalog's order, once each":    {[]string{"tasks.view", "customers.view", "customers.view"}, []access.Permission{"customers.view", "tasks.view"}, ""},
		"nothing":                              {[]string{}, []access.Permission{}, ""},
		"an action without the view":           {[]string{"customers.create"}, nil, "«Mijozlar» bo'limida avval «Ko'rish» ni belgilang"},
		"the first section at fault":           {[]string{"settings.delete", "settings.view", "tasks.edit"}, nil, "«Vazifalar» bo'limida avval «Ko'rish» ni belgilang"},
		"not in the catalog":                   {[]string{"customers.fly"}, nil, "Ruxsat noto'g'ri"},
		"the owner's rights are no permission": {[]string{"roles.manage"}, nil, "Ruxsat noto'g'ri"},
		"a warehouse action without the view":  {[]string{"purchases.create"}, nil, "«Xaridlar» bo'limida avval «Ko'rish» ni belgilang"},
		"a sale without the view":              {[]string{"sales.edit"}, nil, "«Sotuv» bo'limida avval «Ko'rish» ni belgilang"},
		"a stock document without the view":    {[]string{"stock.delete"}, nil, "«Ombor hujjatlari» bo'limida avval «Ko'rish» ni belgilang"},
		"a finance action without the view":    {[]string{"finance.create"}, nil, "«Moliya» bo'limida avval «Ko'rish» ni belgilang"},
		"the new sections with their view":     {[]string{"finance.view", "stock.view", "sales.view", "sales.create"}, []access.Permission{"sales.view", "sales.create", "stock.view", "finance.view"}, ""},
		"a product action with its view":       {[]string{"products.edit", "products.view"}, []access.Permission{"products.view", "products.edit"}, ""},
	} {
		got, err := access.Parse(tc.raw)
		if tc.err == "" {
			require.NoError(t, err, name)
			assert.Equal(t, tc.want, got, name)
			continue
		}
		var appErr *apperr.Error
		require.ErrorAs(t, err, &appErr, name)
		assert.Equal(t, apperr.Invalid, appErr.Kind, name)
		assert.Equal(t, "validation_error", appErr.Code, name)
		assert.Equal(t, tc.err, appErr.Message, name)
		assert.Nil(t, got, name)
	}
}

func TestEffective(t *testing.T) {
	t.Parallel()
	assert.Equal(t, access.NewSet(access.All), access.Effective("owner", false, nil), "the owner has everything")
	assert.Equal(t, access.NewSet(access.Default), access.Effective("user", false, nil), "a user with no role has the default")
	withRole := access.Effective("user", true, []string{"tasks.view"})
	assert.True(t, withRole.Has(access.TasksView))
	assert.False(t, withRole.Has(access.CustomersView), "only what the role holds")
	assert.Equal(t, []access.Permission{access.TasksView}, withRole.List())
	assert.Empty(t, access.Effective("user", true, []string{}).List(), "a role with nothing")
	assert.Equal(t, access.NewSet(access.All), access.Effective("owner", true, []string{"tasks.view"}), "the owner's rights do not depend on a role")
}

func TestSetListsInTheCatalogsOrder(t *testing.T) {
	t.Parallel()
	set := access.NewSet([]access.Permission{access.SettingsView, access.CustomersView})
	assert.Equal(t, []access.Permission{access.CustomersView, access.SettingsView}, set.List())
	assert.Equal(t, []access.Permission{}, access.Set(nil).List(), "no permissions is an empty list, not nil")
	assert.False(t, access.Set(nil).Has(access.CustomersView))
}
