// Package access is the catalog of what a member of a company may do: the
// permissions a company role is made of, the set a member without a role
// has, and the set the owner has (everything). It knows no database
// (logic/roles.md, section 4).
package access

import (
	"fmt"
	"strings"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
)

// Permission is one thing a member may do, as "section.action".
type Permission string

// The sections and their actions. Every section has view, create, edit and
// delete; the customers and the tasks have a history too.
const (
	CustomersView    Permission = "customers.view"
	CustomersCreate  Permission = "customers.create"
	CustomersEdit    Permission = "customers.edit"
	CustomersDelete  Permission = "customers.delete"
	CustomersHistory Permission = "customers.history"
	TasksView        Permission = "tasks.view"
	TasksCreate      Permission = "tasks.create"
	TasksEdit        Permission = "tasks.edit"
	TasksDelete      Permission = "tasks.delete"
	TasksHistory     Permission = "tasks.history"
	EmployeesView    Permission = "employees.view"
	EmployeesCreate  Permission = "employees.create"
	EmployeesEdit    Permission = "employees.edit"
	EmployeesDelete  Permission = "employees.delete"
	SettingsView     Permission = "settings.view"
	SettingsCreate   Permission = "settings.create"
	SettingsEdit     Permission = "settings.edit"
	SettingsDelete   Permission = "settings.delete"
)

// All is the catalog in its order: what the owner has.
var All = []Permission{
	CustomersView, CustomersCreate, CustomersEdit, CustomersDelete, CustomersHistory,
	TasksView, TasksCreate, TasksEdit, TasksDelete, TasksHistory,
	EmployeesView, EmployeesCreate, EmployeesEdit, EmployeesDelete,
	SettingsView, SettingsCreate, SettingsEdit, SettingsDelete,
}

// Default is what a user with no role has: the customers and the tasks,
// without their history. It is the rule from before roles existed.
var Default = []Permission{
	CustomersView, CustomersCreate, CustomersEdit, CustomersDelete,
	TasksView, TasksCreate, TasksEdit, TasksDelete,
}

// sectionNames are the sections' names in the app, for the messages.
var sectionNames = map[string]string{
	"customers": "Mijozlar",
	"tasks":     "Vazifalar",
	"employees": "Xodimlar",
	"settings":  "Sozlamalar",
}

var known = NewSet(All)

// Set is a member's permissions, for asking whether one is among them.
type Set map[Permission]bool

// NewSet is the set of perms.
func NewSet(perms []Permission) Set {
	s := make(Set, len(perms))
	for _, p := range perms {
		s[p] = true
	}
	return s
}

// Has tells whether p is in the set.
func (s Set) Has(p Permission) bool { return s[p] }

// List is the set in the catalog's order, empty rather than nil: it goes
// out as JSON.
func (s Set) List() []Permission {
	list := make([]Permission, 0, len(s))
	for _, p := range All {
		if s[p] {
			list = append(list, p)
		}
	}
	return list
}

// section is the part before the dot: "customers" of "customers.view".
func (p Permission) section() string {
	section, _, _ := strings.Cut(string(p), ".")
	return section
}

// Parse reads a role's permissions as a client sends them: each has to be
// in the catalog, a repeated one counts once, and an action of a section
// comes with the section's view. The list comes back in the catalog's order.
func Parse(raw []string) ([]Permission, error) {
	set := make(Set, len(raw))
	for _, r := range raw {
		p := Permission(r)
		if !known.Has(p) {
			return nil, apperr.New(apperr.Invalid, "validation_error", "Ruxsat noto'g'ri")
		}
		set[p] = true
	}
	for _, p := range All {
		if set[p] && !set[Permission(p.section()+".view")] {
			return nil, apperr.New(apperr.Invalid, "validation_error",
				fmt.Sprintf("«%s» bo'limida avval «Ko'rish» ni belgilang", sectionNames[p.section()]))
		}
	}
	return set.List(), nil
}

// Effective is what a member may do right now: the owner everything, a user
// with no role the Default, a user with a role what the role holds.
func Effective(role string, hasRole bool, rolePerms []string) Set {
	switch {
	case role == "owner":
		return NewSet(All)
	case !hasRole:
		return NewSet(Default)
	}
	s := make(Set, len(rolePerms))
	for _, p := range rolePerms {
		s[Permission(p)] = true
	}
	return s
}
