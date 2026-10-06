package customer

import (
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
)

// What a customer of the company uses is not deleted; the deleted customers
// use nothing.

func TestATypeWithCustomersIsNotDeleted(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := newShop(t, s, pool, "Olma")
	ali := mustCustomer(t, s, olma.id, olma.jismoniy.ID, aliPhone, map[int64]any{olma.fish.ID: "Ali"})
	vali := mustCustomer(t, s, olma.id, olma.jismoniy.ID, valiPhone, map[int64]any{olma.fish.ID: "Vali"})

	err := s.DeleteType(ctx, olma.id, olma.jismoniy.ID)

	refused(t, err, apperr.Conflict, "type_in_use", "Bu turda 2 ta mijoz bor")
	assert.Equal(t, []string{"Jismoniy", "Yuridik"}, typeNames(t, s, olma.id), "the type stays")
	types, err := s.Types(ctx, olma.id)
	require.NoError(t, err)
	assert.Len(t, types[0].Fields, 6, "with its fields")

	assert.NoError(t, s.DeleteType(ctx, olma.id, olma.yuridik.ID), "a type with no customers")
	require.NoError(t, s.Delete(ctx, olma.id, ali.ID, owner))
	refused(t, s.DeleteType(ctx, olma.id, olma.jismoniy.ID), apperr.Conflict, "type_in_use", "Bu turda 1 ta mijoz bor")
	require.NoError(t, s.Delete(ctx, olma.id, vali.ID, owner))
	assert.NoError(t, s.DeleteType(ctx, olma.id, olma.jismoniy.ID), "the deleted customers do not hold the type")
}

func TestAFieldCustomersFilledInIsNotDeleted(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := newShop(t, s, pool, "Olma")
	ali := mustCustomer(t, s, olma.id, olma.jismoniy.ID, aliPhone, map[int64]any{
		olma.fish.ID: "Ali", olma.yosh.ID: 30, olma.tillar.ID: []int64{olma.uzbek.ID, olma.rus.ID},
	})
	mustCustomer(t, s, olma.id, olma.jismoniy.ID, valiPhone, map[int64]any{olma.fish.ID: "Vali", olma.tillar.ID: []int64{olma.rus.ID}})

	refused(t, s.DeleteField(ctx, olma.id, olma.jismoniy.ID, olma.fish.ID), apperr.Conflict, "field_in_use", "Bu maydon 2 ta mijozda to'ldirilgan")
	refused(t, s.DeleteField(ctx, olma.id, olma.jismoniy.ID, olma.tillar.ID), apperr.Conflict, "field_in_use",
		"Bu maydon 2 ta mijozda to'ldirilgan", "a customer who chose two options counts once")
	refused(t, s.DeleteField(ctx, olma.id, olma.jismoniy.ID, olma.yosh.ID), apperr.Conflict, "field_in_use", "Bu maydon 1 ta mijozda to'ldirilgan")
	types, err := s.Types(ctx, olma.id)
	require.NoError(t, err)
	assert.Len(t, types[0].Fields, 6, "the fields stay")

	assert.NoError(t, s.DeleteField(ctx, olma.id, olma.jismoniy.ID, olma.manba.ID), "a field nobody filled in")
	require.NoError(t, s.Delete(ctx, olma.id, ali.ID, owner))
	assert.NoError(t, s.DeleteField(ctx, olma.id, olma.jismoniy.ID, olma.yosh.ID), "a deleted customer's answer does not hold the field")
	// An edit that empties the field frees it too.
	_, err = s.Update(ctx, olma.id, mustCustomer(t, s, olma.id, olma.jismoniy.ID, "998900000001",
		map[int64]any{olma.fish.ID: "Soli", olma.jinsi.ID: olma.erkak.ID}).ID, owner,
		Input{Phone: "998900000001", Values: answers(t, map[int64]any{olma.fish.ID: "Soli"})})
	require.NoError(t, err)
	assert.NoError(t, s.DeleteField(ctx, olma.id, olma.jismoniy.ID, olma.jinsi.ID), "an answer that was taken away does not hold it")
}

func TestAnOptionCustomersChoseIsNotDeleted(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := newShop(t, s, pool, "Olma")
	manba := *olma.manba.DropdownID
	// Ali chose Instagram in two fields, Vali in one.
	ali := mustCustomer(t, s, olma.id, olma.jismoniy.ID, aliPhone, map[int64]any{
		olma.fish.ID: "Ali", olma.manba.ID: olma.instagram.ID, olma.kanallar.ID: []int64{olma.instagram.ID, olma.linkedin.ID},
	})
	vali := mustCustomer(t, s, olma.id, olma.jismoniy.ID, valiPhone, map[int64]any{olma.fish.ID: "Vali", olma.manba.ID: olma.instagram.ID})

	err := s.DeleteOption(ctx, olma.id, manba, olma.instagram.ID)

	refused(t, err, apperr.Conflict, "option_in_use", "Bu variant 2 ta mijozda tanlangan")
	refused(t, s.DeleteOption(ctx, olma.id, manba, olma.linkedin.ID), apperr.Conflict, "option_in_use", "Bu variant 1 ta mijozda tanlangan")
	dropdowns, err := s.Dropdowns(ctx, olma.id)
	require.NoError(t, err)
	assert.Len(t, dropdowns[0].Options, 3, "the options stay")

	assert.NoError(t, s.DeleteOption(ctx, olma.id, manba, olma.youtube.ID), "an option nobody chose")
	// An option in use can be turned off instead.
	_, err = s.UpdateOption(ctx, olma.id, manba, olma.instagram.ID, OptionPatch{Active: ptr(false)})
	assert.NoError(t, err, "turning off is no deleting")
	require.NoError(t, s.Delete(ctx, olma.id, ali.ID, owner))
	assert.NoError(t, s.DeleteOption(ctx, olma.id, manba, olma.linkedin.ID), "a deleted customer's choice does not hold the option")
	_, err = s.Update(ctx, olma.id, vali.ID, owner, Input{Phone: valiPhone, Values: answers(t, map[int64]any{olma.fish.ID: "Vali"})})
	require.NoError(t, err)
	assert.NoError(t, s.DeleteOption(ctx, olma.id, manba, olma.instagram.ID), "a choice that was taken back does not hold it")
}

func TestAFieldWithRepeatedAnswersCannotBeToldNotToRepeat(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := newShop(t, s, pool, "Olma")
	mustCustomer(t, s, olma.id, olma.jismoniy.ID, aliPhone, map[int64]any{olma.fish.ID: "Ali Valiyev", olma.yosh.ID: 30})
	vali := mustCustomer(t, s, olma.id, olma.jismoniy.ID, valiPhone, map[int64]any{olma.fish.ID: "ali valiyev", olma.yosh.ID: 31})
	const repeats = "Bu maydonda takrorlangan qiymatlar bor"

	_, err := s.UpdateField(ctx, olma.id, olma.jismoniy.ID, olma.fish.ID, FieldPatch{Unique: ptr(true)})

	refused(t, err, apperr.Conflict, "duplicates_exist", repeats, "two customers of one name, whatever the case")
	_, err = s.UpdateField(ctx, olma.id, olma.jismoniy.ID, olma.fish.ID, FieldPatch{Label: ptr("Ism"), Unique: ptr(true)})
	refused(t, err, apperr.Conflict, "duplicates_exist", repeats)
	types, err := s.Types(ctx, olma.id)
	require.NoError(t, err)
	assert.Equal(t, olma.fish, types[0].Fields[0], "the field stays as it was, its name too")

	yosh, err := s.UpdateField(ctx, olma.id, olma.jismoniy.ID, olma.yosh.ID, FieldPatch{Unique: ptr(true)})
	require.NoError(t, err, "a field whose answers are all different")
	assert.True(t, yosh.Unique)
	_, err = s.UpdateField(ctx, olma.id, olma.jismoniy.ID, olma.fish.ID, FieldPatch{Label: ptr("Ism"), Required: ptr(false), Unique: ptr(false)})
	assert.NoError(t, err, "what does not ask for it is not checked")

	require.NoError(t, s.Delete(ctx, olma.id, vali.ID, owner))
	ism, err := s.UpdateField(ctx, olma.id, olma.jismoniy.ID, olma.fish.ID, FieldPatch{Unique: ptr(true)})
	require.NoError(t, err, "a deleted customer's answer is no repeat")
	assert.True(t, ism.Unique)
}

// taskSetup is what a task of the company needs: a stage, a type, and a
// checkbox field Kanal of the type over the dropdown Manba.
type taskSetup struct {
	companyID, stageID, typeID, fieldID int64
}

// setupTasks makes the company ready for tasks.
func setupTasks(t *testing.T, pool *pgxpool.Pool, sh shop) taskSetup {
	t.Helper()
	ctx := t.Context()
	ts := taskSetup{companyID: sh.id}
	require.NoError(t, pool.QueryRow(ctx,
		"INSERT INTO task_stages (company_id, name, color, position) VALUES ($1, 'Yangi', 'blue', 1) RETURNING id", sh.id).Scan(&ts.stageID))
	require.NoError(t, pool.QueryRow(ctx,
		"INSERT INTO task_types (company_id, name, position) VALUES ($1, 'Vazifa', 1) RETURNING id", sh.id).Scan(&ts.typeID))
	require.NoError(t, pool.QueryRow(ctx, `INSERT INTO task_fields (company_id, type_id, label, kind, dropdown_id, position)
		VALUES ($1, $2, 'Kanal', 'checkbox', $3, 1) RETURNING id`, sh.id, ts.typeID, *sh.manba.DropdownID).Scan(&ts.fieldID))
	return ts
}

// addTask enters a task for the customer the way the task service does
// (that package is built on this one, so it cannot be called here), with
// the options chosen in Kanal.
func addTask(t *testing.T, pool *pgxpool.Pool, ts taskSetup, customerID int64, chosen ...int64) int64 {
	t.Helper()
	ctx := t.Context()
	var taskID int64
	require.NoError(t, pool.QueryRow(ctx, `INSERT INTO tasks (company_id, type_id, stage_id, customer_id, title, deadline, created_by)
		VALUES ($1, $2, $3, $4, 'Qo''ng''iroq', CURRENT_DATE, $5) RETURNING id`, ts.companyID, ts.typeID, ts.stageID, customerID, owner).Scan(&taskID))
	for _, optionID := range chosen {
		_, err := pool.Exec(ctx, "INSERT INTO task_values (task_id, field_id, option_id) VALUES ($1, $2, $3)", taskID, ts.fieldID, optionID)
		require.NoError(t, err)
	}
	return taskID
}

// hideTask deletes a task the way the task service does.
func hideTask(t *testing.T, pool *pgxpool.Pool, taskID int64) {
	t.Helper()
	_, err := pool.Exec(t.Context(), "UPDATE tasks SET deleted_at = now() WHERE id = $1", taskID)
	require.NoError(t, err)
}

func TestACustomerWithTasksIsNotDeleted(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := newShop(t, s, pool, "Olma")
	ts := setupTasks(t, pool, olma)
	ali := mustCustomer(t, s, olma.id, olma.jismoniy.ID, aliPhone, map[int64]any{olma.fish.ID: "Ali"})
	vali := mustCustomer(t, s, olma.id, olma.jismoniy.ID, valiPhone, map[int64]any{olma.fish.ID: "Vali"})
	soli := mustCustomer(t, s, olma.id, olma.jismoniy.ID, "998900000001", map[int64]any{olma.fish.ID: "Soli"})
	addTask(t, pool, ts, ali.ID)
	addTask(t, pool, ts, ali.ID)
	hideTask(t, pool, addTask(t, pool, ts, ali.ID))
	valis := addTask(t, pool, ts, vali.ID)

	err := s.Delete(ctx, olma.id, ali.ID, owner)

	refused(t, err, apperr.Conflict, "customer_in_use", "Bu mijozda 2 ta vazifa bor")
	got, err := s.Get(ctx, olma.id, ali.ID)
	require.NoError(t, err, "the customer stays")
	assert.Equal(t, aliPhone, got.Phone)
	history, err := s.History(ctx, olma.id, ali.ID)
	require.NoError(t, err)
	assert.Len(t, history, 1, "and nothing is written down")

	refused(t, s.Delete(ctx, olma.id, vali.ID, owner), apperr.Conflict, "customer_in_use", "Bu mijozda 1 ta vazifa bor")
	assert.NoError(t, s.Delete(ctx, olma.id, soli.ID, owner), "a customer with no tasks")
	hideTask(t, pool, valis)
	assert.NoError(t, s.Delete(ctx, olma.id, vali.ID, owner), "the deleted tasks do not hold the customer")
}

func TestAnOptionTasksChoseIsNotDeleted(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := newShop(t, s, pool, "Olma")
	ts := setupTasks(t, pool, olma)
	manba := *olma.manba.DropdownID
	ali := mustCustomer(t, s, olma.id, olma.jismoniy.ID, aliPhone, map[int64]any{olma.fish.ID: "Ali"})
	// Two tasks chose Instagram, one of them LinkedIn too; a deleted task
	// chose YouTube.
	addTask(t, pool, ts, ali.ID, olma.instagram.ID, olma.linkedin.ID)
	addTask(t, pool, ts, ali.ID, olma.instagram.ID)
	hideTask(t, pool, addTask(t, pool, ts, ali.ID, olma.youtube.ID))

	err := s.DeleteOption(ctx, olma.id, manba, olma.instagram.ID)

	refused(t, err, apperr.Conflict, "option_in_use", "Bu variant 2 ta vazifada tanlangan")
	refused(t, s.DeleteOption(ctx, olma.id, manba, olma.linkedin.ID), apperr.Conflict, "option_in_use", "Bu variant 1 ta vazifada tanlangan")
	dropdowns, err := s.Dropdowns(ctx, olma.id)
	require.NoError(t, err)
	assert.Len(t, dropdowns[0].Options, 3, "the options stay")

	assert.NoError(t, s.DeleteOption(ctx, olma.id, manba, olma.youtube.ID), "a deleted task's choice does not hold the option")
	// The customers are told first.
	_, err = s.Update(ctx, olma.id, ali.ID, owner, Input{Phone: aliPhone, Values: answers(t, map[int64]any{olma.fish.ID: "Ali", olma.manba.ID: olma.instagram.ID})})
	require.NoError(t, err)
	refused(t, s.DeleteOption(ctx, olma.id, manba, olma.instagram.ID), apperr.Conflict, "option_in_use", "Bu variant 1 ta mijozda tanlangan")
}
