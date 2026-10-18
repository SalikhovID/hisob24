package db_test

import (
	"fmt"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

// assignedTo is the member the orders of these tests are assigned to.
const assignedTo = "998902222222"

// day is a date as the queries take it.
func day(s string) time.Time {
	d, err := time.Parse(time.DateOnly, s)
	if err != nil {
		panic(err)
	}
	return d
}

// orderShop is a company set up for orders: enteredBy (its owner, "Ali
// Valiyev") and assignedTo (a user, "Vali Aliyev"); its location Asosiy; a
// customer type with a name field and the customer Ali; two stages; an order
// type with a text field, a whole number and a choice over Manba.
type orderShop struct {
	company             gen.Company
	asosiy              int64
	jismoniy            gen.CustomerType
	fish                gen.CustomerField
	ali                 gen.Customer
	yangi, bajarildi    gen.OrderStage
	buyurtma            gen.OrderType
	izoh, summa, kanal  gen.OrderField
	manba               gen.CustomerDropdown
	instagram, linkedin gen.CustomerDropdownOption
}

func newOrderShop(t *testing.T, q *gen.Queries, pool *pgxpool.Pool, name string) orderShop {
	t.Helper()
	var s orderShop
	s.company = createCompany(t, q, name, today(t, pool))
	mustExec(t, pool, "INSERT INTO users (phone) VALUES ($1), ($2) ON CONFLICT (phone) DO NOTHING", enteredBy, assignedTo)
	mustExec(t, pool, `INSERT INTO user_companies (user_phone, company_id, role, full_name)
		VALUES ($1, $3, 'owner', 'Ali Valiyev'), ($2, $3, 'user', 'Vali Aliyev')`, enteredBy, assignedTo, s.company.ID)
	s.asosiy = addLocation(t, pool, s.company.ID, "Asosiy")
	s.jismoniy = createType(t, q, s.company.ID, "Jismoniy")
	s.fish = addField(t, q, s.company.ID, s.jismoniy.ID, "F.I.Sh.", "string", nil)
	s.ali = createCustomer(t, q, s.company.ID, s.jismoniy.ID, "998901234567")
	answer(t, q, s.ali.ID, s.fish.ID, "Ali Valiyev")
	s.yangi = createStage(t, q, s.company.ID, "Yangi", "blue")
	s.bajarildi = createStage(t, q, s.company.ID, "Bajarildi", "green")
	s.manba = createDropdown(t, q, s.company.ID, "Manba")
	s.instagram = addOption(t, q, s.company.ID, s.manba.ID, "Instagram")
	s.linkedin = addOption(t, q, s.company.ID, s.manba.ID, "LinkedIn")
	s.buyurtma = createOrderType(t, q, s.company.ID, "Buyurtma")
	s.izoh = addOrderField(t, q, s.company.ID, s.buyurtma.ID, "Izoh", "string", nil)
	s.summa = addOrderField(t, q, s.company.ID, s.buyurtma.ID, "Summa", "int", nil)
	s.kanal = addOrderField(t, q, s.company.ID, s.buyurtma.ID, "Kanal", "checkbox", &s.manba.ID)
	return s
}

// nextNumber is the number the company's next order takes.
func nextNumber(t *testing.T, q *gen.Queries, companyID int64) int32 {
	t.Helper()
	n, err := q.NextOrderNumber(t.Context(), companyID)
	require.NoError(t, err)
	return n
}

// order enters an order of the shop's type for Ali, in the first stage and in
// Asosiy, as enteredBy, under the next number; assignee is the member it
// is assigned to, if any.
func (s orderShop) order(t *testing.T, q *gen.Queries, deadline string, assignee *string) gen.Order {
	t.Helper()
	var assigneeName *string
	if assignee != nil {
		assigneeName = ptr("Vali Aliyev")
	}
	order, err := q.CreateOrder(t.Context(), gen.CreateOrderParams{
		CompanyID: s.company.ID, TypeID: s.buyurtma.ID, StageID: s.yangi.ID, CustomerID: s.ali.ID, LocationID: s.asosiy,
		Number: nextNumber(t, q, s.company.ID), Deadline: day(deadline), AssigneePhone: assignee, AssigneeName: assigneeName,
		CreatedBy: enteredBy, CreatedByName: ptr("Ali Valiyev"),
	})
	require.NoError(t, err)
	return order
}

func TestCreateOrder(t *testing.T) {
	q, pool := setup(t)
	s := newOrderShop(t, q, pool, "Olma")

	order, err := q.CreateOrder(t.Context(), gen.CreateOrderParams{
		CompanyID: s.company.ID, TypeID: s.buyurtma.ID, StageID: s.yangi.ID, CustomerID: s.ali.ID, LocationID: s.asosiy,
		Number: 7, Deadline: day("2026-10-10"), AssigneePhone: ptr(assignedTo), AssigneeName: ptr("Vali aka"),
		CreatedBy: enteredBy, CreatedByName: ptr("Ali aka"),
	})

	require.NoError(t, err)
	assert.Positive(t, order.ID)
	assert.Equal(t, s.company.ID, order.CompanyID)
	assert.Equal(t, s.buyurtma.ID, order.TypeID)
	assert.Equal(t, s.yangi.ID, order.StageID)
	assert.Equal(t, s.ali.ID, order.CustomerID)
	assert.Equal(t, s.asosiy, order.LocationID, "the location the order stands in")
	assert.EqualValues(t, 7, order.Number, "the number given")
	assert.True(t, order.Deadline.Equal(day("2026-10-10")), "deadline %s", order.Deadline)
	assert.Equal(t, ptr(assignedTo), order.AssigneePhone)
	assert.Equal(t, ptr("Vali aka"), order.AssigneeName, "the name the assignee went by then")
	assert.Equal(t, ptr("Ali aka"), order.CreatedByName, "the name the member went by then")
	assert.Equal(t, order.CreatedAt, order.UpdatedAt, "not edited yet")
	assert.Nil(t, order.DeletedAt)
	unassigned := s.order(t, q, "2026-10-11", nil)
	assert.Nil(t, unassigned.AssigneePhone)
	assert.Nil(t, unassigned.AssigneeName)
}

func TestGetOrder(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	s := newOrderShop(t, q, pool, "Olma")
	nok := createCompany(t, q, "Nok", today(t, pool))
	order := s.order(t, q, "2026-10-10", ptr(assignedTo))

	got, err := q.GetOrder(ctx, gen.GetOrderParams{ID: order.ID, CompanyID: s.company.ID, LocationIds: []int64{s.asosiy}})

	require.NoError(t, err)
	assert.EqualValues(t, 1, got.Number)
	assert.Equal(t, s.asosiy, got.LocationID, "the location the order stands in")
	assert.Equal(t, "998901234567", got.CustomerPhone)
	assert.Equal(t, ptr("Ali Valiyev"), got.CustomerName, "the customer's answer to its type's first text field")
	assert.Equal(t, ptr("Vali Aliyev"), got.AssigneeName, "the name the assignee goes by in the company now")
	assert.Equal(t, ptr("Ali Valiyev"), got.CreatedByName)

	mustExec(t, pool, "UPDATE user_companies SET full_name = 'Vali (yangi)' WHERE user_phone = $1", assignedTo)
	got, err = q.GetOrder(ctx, gen.GetOrderParams{ID: order.ID, CompanyID: s.company.ID, LocationIds: []int64{s.asosiy}})
	require.NoError(t, err)
	assert.Equal(t, ptr("Vali (yangi)"), got.AssigneeName, "the name as it is now")
	mustExec(t, pool, "DELETE FROM user_companies WHERE user_phone = $1", assignedTo)
	got, err = q.GetOrder(ctx, gen.GetOrderParams{ID: order.ID, CompanyID: s.company.ID, LocationIds: []int64{s.asosiy}})
	require.NoError(t, err)
	assert.Equal(t, ptr("Vali Aliyev"), got.AssigneeName, "once they have left the company, the name of then")

	nameless := createCustomer(t, q, s.company.ID, s.jismoniy.ID, "998907654321")
	other, err := q.CreateOrder(ctx, gen.CreateOrderParams{
		CompanyID: s.company.ID, TypeID: s.buyurtma.ID, StageID: s.yangi.ID, CustomerID: nameless.ID, LocationID: s.asosiy,
		Number: nextNumber(t, q, s.company.ID), Deadline: day("2026-10-10"), CreatedBy: enteredBy,
	})
	require.NoError(t, err)
	got, err = q.GetOrder(ctx, gen.GetOrderParams{ID: other.ID, CompanyID: s.company.ID, LocationIds: []int64{s.asosiy}})
	require.NoError(t, err)
	assert.Nil(t, got.CustomerName, "a customer that goes by no name")

	_, err = q.GetOrder(ctx, gen.GetOrderParams{ID: order.ID, CompanyID: nok.ID, LocationIds: []int64{s.asosiy}})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's order")
	mustExec(t, pool, "UPDATE orders SET deleted_at = now() WHERE id = $1", order.ID)
	_, err = q.GetOrder(ctx, gen.GetOrderParams{ID: order.ID, CompanyID: s.company.ID, LocationIds: []int64{s.asosiy}})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "a deleted order")
}

// numbers is the numbers of the orders listed, in their order.
func numbers(rows []gen.ListOrdersRow) []int32 {
	list := make([]int32, 0, len(rows))
	for _, r := range rows {
		list = append(list, r.Number)
	}
	return list
}

// seedOrders enters five orders into the shop: three due on different days,
// one of them assigned, one of another type for another customer, and one
// deleted. It returns the orders that stay.
func seedOrders(t *testing.T, q *gen.Queries, pool *pgxpool.Pool, s orderShop) (later, sooner, soonest, other gen.Order) {
	t.Helper()
	later = s.order(t, q, "2026-10-12", nil)
	sooner = s.order(t, q, "2026-10-10", ptr(assignedTo))
	soonest = s.order(t, q, "2026-10-09", nil)
	vali := createCustomer(t, q, s.company.ID, s.jismoniy.ID, "998905555555")
	answer(t, q, vali.ID, s.fish.ID, "Zarina Karimova")
	inn := addField(t, q, s.company.ID, s.jismoniy.ID, "INN", "int", nil)
	answerNumber(t, q, vali.ID, inn.ID, 301234567)
	shikoyat := createOrderType(t, q, s.company.ID, "Shikoyat")
	done := createStage(t, q, s.company.ID, "Yopiq", "slate")
	var err error
	other, err = q.CreateOrder(t.Context(), gen.CreateOrderParams{
		CompanyID: s.company.ID, TypeID: shikoyat.ID, StageID: done.ID, CustomerID: vali.ID, LocationID: s.asosiy,
		Number: nextNumber(t, q, s.company.ID), Deadline: day("2026-10-10"), CreatedBy: enteredBy,
	})
	require.NoError(t, err)
	gone := s.order(t, q, "2026-10-01", nil)
	mustExec(t, pool, "UPDATE orders SET deleted_at = now() WHERE id = $1", gone.ID)
	return later, sooner, soonest, other
}

func TestListOrders(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	s := newOrderShop(t, q, pool, "Olma")
	nok := newOrderShop(t, q, pool, "Nok")
	nok.order(t, q, "2026-10-01", nil)
	later, sooner, soonest, other := seedOrders(t, q, pool, s)
	require.NoError(t, q.AddOrderValue(ctx, gen.AddOrderValueParams{OrderID: later.ID, FieldID: s.izoh.ID, TextValue: ptr("Ertalab yozish")}))
	require.NoError(t, q.AddOrderValue(ctx, gen.AddOrderValueParams{OrderID: later.ID, FieldID: s.summa.ID, IntValue: ptr(int64(45000))}))
	all := gen.ListOrdersParams{CompanyID: s.company.ID, LocationIds: []int64{s.asosiy}, Limit: 20}

	rows, err := q.ListOrders(ctx, all)

	require.NoError(t, err)
	assert.Equal(t, []int32{3, 2, 4, 1}, numbers(rows),
		"the one due soonest first, the older order before the newer of one day; the deleted one and another company's are out")
	assert.Equal(t, "998901234567", rows[0].CustomerPhone)
	assert.Equal(t, ptr("Ali Valiyev"), rows[0].CustomerName)
	assert.Equal(t, ptr("Vali Aliyev"), rows[1].AssigneeName)
	assert.Nil(t, rows[0].AssigneeName)

	page := all
	page.Limit, page.Offset = 2, 2
	rows, err = q.ListOrders(ctx, page)
	require.NoError(t, err)
	assert.Equal(t, []int32{4, 1}, numbers(rows), "the second page of two")

	for about, tc := range map[string]struct {
		params func(p gen.ListOrdersParams) gen.ListOrdersParams
		want   []int32
	}{
		"of one type":                          {func(p gen.ListOrdersParams) gen.ListOrdersParams { p.TypeID = &other.TypeID; return p }, []int32{4}},
		"in one stage":                         {func(p gen.ListOrdersParams) gen.ListOrdersParams { p.StageID = &s.yangi.ID; return p }, []int32{3, 2, 1}},
		"of one assignee":                      {func(p gen.ListOrdersParams) gen.ListOrdersParams { p.AssigneePhone = ptr(assignedTo); return p }, []int32{2}},
		"of one customer":                      {func(p gen.ListOrdersParams) gen.ListOrdersParams { p.CustomerID = &other.CustomerID; return p }, []int32{4}},
		"a search in the order's text answers": {func(p gen.ListOrdersParams) gen.ListOrdersParams { p.Search = ptr("ertalab"); return p }, []int32{1}},
		"a search in the customer's name":      {func(p gen.ListOrdersParams) gen.ListOrdersParams { p.Search = ptr("karim"); return p }, []int32{4}},
		"a number in the customer's phone": {func(p gen.ListOrdersParams) gen.ListOrdersParams {
			p.Search, p.Digits = ptr("5555"), ptr("5555")
			return p
		}, []int32{4}},
		"a number in the order's answers": {func(p gen.ListOrdersParams) gen.ListOrdersParams {
			p.Search, p.Digits = ptr("450"), ptr("450")
			return p
		}, []int32{1}},
		"a number in the customer's number answers": {func(p gen.ListOrdersParams) gen.ListOrdersParams {
			p.Search, p.Digits = ptr("3012"), ptr("3012")
			return p
		}, []int32{4}},
		"a search that finds nothing": {func(p gen.ListOrdersParams) gen.ListOrdersParams { p.Search = ptr("yo'q"); return p }, []int32{}},
		"a stage and a search together": {func(p gen.ListOrdersParams) gen.ListOrdersParams {
			p.StageID, p.Search = &s.yangi.ID, ptr("karim")
			return p
		}, []int32{}},
	} {
		rows, err := q.ListOrders(ctx, tc.params(all))
		require.NoError(t, err, about)
		assert.Equal(t, tc.want, numbers(rows), about)
		p := tc.params(all)
		count, err := q.CountOrders(ctx, gen.CountOrdersParams{
			CompanyID: p.CompanyID, LocationIds: p.LocationIds, TypeID: p.TypeID, StageID: p.StageID, AssigneePhone: p.AssigneePhone,
			CustomerID: p.CustomerID, Search: p.Search, Digits: p.Digits,
		})
		require.NoError(t, err, about)
		assert.EqualValues(t, len(tc.want), count, "the count of %s", about)
	}
	_ = sooner
	_ = soonest
}

func TestUpdateOrder(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	s := newOrderShop(t, q, pool, "Olma")
	nok := createCompany(t, q, "Nok", today(t, pool))
	order := s.order(t, q, "2026-10-10", nil)
	mustExec(t, pool, "UPDATE orders SET updated_at = created_at - interval '1 hour' WHERE id = $1", order.ID)

	updatedAt, err := q.UpdateOrder(ctx, gen.UpdateOrderParams{
		ID: order.ID, CompanyID: s.company.ID, LocationIds: []int64{s.asosiy}, Deadline: day("2026-10-12"), StageID: s.bajarildi.ID,
		AssigneePhone: ptr(assignedTo), AssigneeName: ptr("Vali Aliyev"),
	})

	require.NoError(t, err)
	assert.True(t, updatedAt.After(order.CreatedAt), "the moment of the edit")
	got, err := q.GetOrder(ctx, gen.GetOrderParams{ID: order.ID, CompanyID: s.company.ID, LocationIds: []int64{s.asosiy}})
	require.NoError(t, err)
	assert.EqualValues(t, 1, got.Number, "the number stays")
	assert.True(t, got.Deadline.Equal(day("2026-10-12")))
	assert.Equal(t, s.bajarildi.ID, got.StageID)
	assert.Equal(t, ptr(assignedTo), got.AssigneePhone)
	assert.Equal(t, s.ali.ID, got.CustomerID, "the customer stays")
	assert.Equal(t, s.buyurtma.ID, got.TypeID, "the type stays")

	_, err = q.UpdateOrder(ctx, gen.UpdateOrderParams{ID: order.ID, CompanyID: nok.ID, LocationIds: []int64{s.asosiy}, Deadline: day("2026-10-12"), StageID: s.yangi.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's order")
	mustExec(t, pool, "UPDATE orders SET deleted_at = now() WHERE id = $1", order.ID)
	_, err = q.UpdateOrder(ctx, gen.UpdateOrderParams{ID: order.ID, CompanyID: s.company.ID, LocationIds: []int64{s.asosiy}, Deadline: day("2026-10-12"), StageID: s.yangi.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "a deleted order")
}

func TestMoveOrder(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	s := newOrderShop(t, q, pool, "Olma")
	nok := createCompany(t, q, "Nok", today(t, pool))
	order := s.order(t, q, "2026-10-10", ptr(assignedTo))
	mustExec(t, pool, "UPDATE orders SET updated_at = created_at - interval '1 hour' WHERE id = $1", order.ID)

	updatedAt, err := q.MoveOrder(ctx, gen.MoveOrderParams{ID: order.ID, CompanyID: s.company.ID, StageID: s.bajarildi.ID, LocationIds: []int64{s.asosiy}})

	require.NoError(t, err)
	assert.True(t, updatedAt.After(order.CreatedAt), "the moment of the move")
	got, err := q.GetOrder(ctx, gen.GetOrderParams{ID: order.ID, CompanyID: s.company.ID, LocationIds: []int64{s.asosiy}})
	require.NoError(t, err)
	assert.Equal(t, s.bajarildi.ID, got.StageID)
	assert.EqualValues(t, 1, got.Number, "nothing else changes")
	assert.Equal(t, ptr(assignedTo), got.AssigneePhone)

	_, err = q.MoveOrder(ctx, gen.MoveOrderParams{ID: order.ID, CompanyID: nok.ID, StageID: s.yangi.ID, LocationIds: []int64{s.asosiy}})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's order")
	mustExec(t, pool, "UPDATE orders SET deleted_at = now() WHERE id = $1", order.ID)
	_, err = q.MoveOrder(ctx, gen.MoveOrderParams{ID: order.ID, CompanyID: s.company.ID, StageID: s.yangi.ID, LocationIds: []int64{s.asosiy}})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "a deleted order")
}

func TestDeleteOrder(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	s := newOrderShop(t, q, pool, "Olma")
	nok := createCompany(t, q, "Nok", today(t, pool))
	order := s.order(t, q, "2026-10-10", nil)

	_, err := q.DeleteOrder(ctx, gen.DeleteOrderParams{ID: order.ID, CompanyID: nok.ID, LocationIds: []int64{s.asosiy}})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's order")
	id, err := q.DeleteOrder(ctx, gen.DeleteOrderParams{ID: order.ID, CompanyID: s.company.ID, LocationIds: []int64{s.asosiy}})
	require.NoError(t, err)
	assert.Equal(t, order.ID, id)

	var hidden bool
	require.NoError(t, pool.QueryRow(ctx, "SELECT deleted_at IS NOT NULL FROM orders WHERE id = $1", order.ID).Scan(&hidden))
	assert.True(t, hidden, "the row stays, marked deleted")
	_, err = q.DeleteOrder(ctx, gen.DeleteOrderParams{ID: order.ID, CompanyID: s.company.ID, LocationIds: []int64{s.asosiy}})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "deleted already")
}

// storedOrderValues is the order's answers as they are stored, each row as
// "field: answer" with an option by its name, in the order of the fields.
func storedOrderValues(t *testing.T, pool *pgxpool.Pool, orderID int64) []string {
	t.Helper()
	rows, err := pool.Query(t.Context(), `SELECT f.label || ': ' || COALESCE(v.text_value, v.int_value::text, o.label)
		FROM order_values v
		JOIN order_fields f ON f.id = v.field_id
		LEFT JOIN customer_dropdown_options o ON o.id = v.option_id
		WHERE v.order_id = $1 ORDER BY f.position, o.position`, orderID)
	require.NoError(t, err)
	stored, err := pgx.CollectRows(rows, pgx.RowTo[string])
	require.NoError(t, err)
	return stored
}

func TestOrderValues(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	s := newOrderShop(t, q, pool, "Olma")
	first := s.order(t, q, "2026-10-10", nil)
	second := s.order(t, q, "2026-10-11", nil)
	mustExec(t, pool, "UPDATE order_fields SET position = 0 WHERE id = $1", s.summa.ID)
	mustExec(t, pool, "UPDATE customer_dropdown_options SET position = 0 WHERE id = $1", s.linkedin.ID)

	require.NoError(t, q.AddOrderValue(ctx, gen.AddOrderValueParams{OrderID: first.ID, FieldID: s.izoh.ID, TextValue: ptr("Ertalab")}))
	require.NoError(t, q.AddOrderValue(ctx, gen.AddOrderValueParams{OrderID: first.ID, FieldID: s.summa.ID, IntValue: ptr(int64(45000))}))
	require.NoError(t, q.AddOrderValue(ctx, gen.AddOrderValueParams{OrderID: first.ID, FieldID: s.kanal.ID, OptionID: &s.instagram.ID}))
	require.NoError(t, q.AddOrderValue(ctx, gen.AddOrderValueParams{OrderID: first.ID, FieldID: s.kanal.ID, OptionID: &s.linkedin.ID}))
	require.NoError(t, q.AddOrderValue(ctx, gen.AddOrderValueParams{OrderID: second.ID, FieldID: s.izoh.ID, TextValue: ptr("Kechqurun")}))
	assert.Equal(t, []string{"Summa: 45000", "Izoh: Ertalab", "Kanal: LinkedIn", "Kanal: Instagram"}, storedOrderValues(t, pool, first.ID))

	rows, err := q.ListOrderValues(ctx, []int64{first.ID, second.ID})
	require.NoError(t, err)
	described := make([]string, 0, len(rows))
	for _, r := range rows {
		described = append(described, fmt.Sprintf("%d %s %v %v %v", r.OrderID, r.Kind, r.OptionID != nil, r.TextValue != nil, r.IntValue != nil))
	}
	assert.Equal(t, []string{
		fmt.Sprintf("%d int false false true", first.ID),
		fmt.Sprintf("%d string false true false", first.ID),
		fmt.Sprintf("%d checkbox true false false", first.ID),
		fmt.Sprintf("%d checkbox true false false", first.ID),
		fmt.Sprintf("%d string false true false", second.ID),
	}, described, "each order's answers in the order of its type's fields, with the field's kind")
	assert.Equal(t, []*int64{&s.linkedin.ID, &s.instagram.ID}, []*int64{rows[2].OptionID, rows[3].OptionID}, "the options in the order of their dropdown")

	require.NoError(t, q.DeleteOrderValues(ctx, first.ID))
	assert.Empty(t, storedOrderValues(t, pool, first.ID), "the order's answers are cleared")
	assert.Equal(t, []string{"Izoh: Kechqurun"}, storedOrderValues(t, pool, second.ID), "the other order's stay")
}

func TestCountOrdersInUse(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	s := newOrderShop(t, q, pool, "Olma")
	first := s.order(t, q, "2026-10-10", nil)
	second := s.order(t, q, "2026-10-11", nil)
	gone := s.order(t, q, "2026-10-12", nil)
	for _, id := range []int64{first.ID, second.ID, gone.ID} {
		require.NoError(t, q.AddOrderValue(ctx, gen.AddOrderValueParams{OrderID: id, FieldID: s.izoh.ID, TextValue: ptr("Izoh")}))
		require.NoError(t, q.AddOrderValue(ctx, gen.AddOrderValueParams{OrderID: id, FieldID: s.kanal.ID, OptionID: &s.instagram.ID}))
	}
	mustExec(t, pool, "UPDATE orders SET deleted_at = now() WHERE id = $1", gone.ID)

	stage, err := q.CountStageOrders(ctx, s.yangi.ID)
	require.NoError(t, err)
	assert.EqualValues(t, 2, stage, "the orders in the stage, without the deleted one")
	none, err := q.CountStageOrders(ctx, s.bajarildi.ID)
	require.NoError(t, err)
	assert.Zero(t, none)
	typ, err := q.CountTypeOrders(ctx, s.buyurtma.ID)
	require.NoError(t, err)
	assert.EqualValues(t, 2, typ, "the orders of the type")
	field, err := q.CountOrderFieldOrders(ctx, s.izoh.ID)
	require.NoError(t, err)
	assert.EqualValues(t, 2, field, "the orders that filled the field in")
	option, err := q.CountOptionOrders(ctx, &s.instagram.ID)
	require.NoError(t, err)
	assert.EqualValues(t, 2, option, "the orders that chose the option")
	unchosen, err := q.CountOptionOrders(ctx, &s.linkedin.ID)
	require.NoError(t, err)
	assert.Zero(t, unchosen)
	customer, err := q.CountCustomerOrders(ctx, s.ali.ID)
	require.NoError(t, err)
	assert.EqualValues(t, 2, customer, "the customer's orders, without the deleted one")
}

func TestOrderHistoryQueries(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	s := newOrderShop(t, q, pool, "Olma")
	order := s.order(t, q, "2026-10-10", nil)
	other := s.order(t, q, "2026-10-11", nil)

	require.NoError(t, q.AddOrderHistory(ctx, gen.AddOrderHistoryParams{OrderID: order.ID, Action: "created", ActorPhone: enteredBy, ActorName: ptr("Ali aka"), Changes: []byte("[]")}))
	require.NoError(t, q.AddOrderHistory(ctx, gen.AddOrderHistoryParams{
		OrderID: order.ID, Action: "updated", ActorPhone: assignedTo, ActorName: ptr("Vali aka"),
		Changes: []byte(`[{"label":"Bosqich","old":"Yangi","new":"Bajarildi"}]`),
	}))
	require.NoError(t, q.AddOrderHistory(ctx, gen.AddOrderHistoryParams{OrderID: other.ID, Action: "created", ActorPhone: enteredBy, Changes: []byte("[]")}))

	rows, err := q.ListOrderHistory(ctx, order.ID)
	require.NoError(t, err)
	require.Len(t, rows, 2, "the order's own entries")
	assert.Equal(t, "updated", rows[0].Action, "the latest first")
	assert.Equal(t, ptr("Vali Aliyev"), rows[0].ActorName, "the name the member goes by in the company now")
	assert.JSONEq(t, `[{"label":"Bosqich","old":"Yangi","new":"Bajarildi"}]`, string(rows[0].Changes))
	assert.Equal(t, "created", rows[1].Action)
	assert.Equal(t, ptr("Ali Valiyev"), rows[1].ActorName)

	mustExec(t, pool, "DELETE FROM user_companies WHERE user_phone = $1", assignedTo)
	rows, err = q.ListOrderHistory(ctx, order.ID)
	require.NoError(t, err)
	assert.Equal(t, ptr("Vali aka"), rows[0].ActorName, "once they have left the company, the name of then")
}

// An order is read and written within the locations named (the ones the
// member may work in): one standing elsewhere is not there to them.
func TestOrdersAreReadWithinTheLocations(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	s := newOrderShop(t, q, pool, "Olma")
	chilonzor := addLocation(t, pool, s.company.ID, "Chilonzor")
	inAsosiy := s.order(t, q, "2026-10-10", nil)
	inChilonzor, err := q.CreateOrder(ctx, gen.CreateOrderParams{
		CompanyID: s.company.ID, TypeID: s.buyurtma.ID, StageID: s.yangi.ID, CustomerID: s.ali.ID, LocationID: chilonzor,
		Number: nextNumber(t, q, s.company.ID), Deadline: day("2026-10-09"), CreatedBy: enteredBy,
	})
	require.NoError(t, err)
	only := []int64{chilonzor}
	both := []int64{s.asosiy, chilonzor}

	rows, err := q.ListOrders(ctx, gen.ListOrdersParams{CompanyID: s.company.ID, LocationIds: both, Limit: 20})
	require.NoError(t, err)
	assert.Equal(t, []int32{2, 1}, numbers(rows), "both locations")
	rows, err = q.ListOrders(ctx, gen.ListOrdersParams{CompanyID: s.company.ID, LocationIds: only, Limit: 20})
	require.NoError(t, err)
	assert.Equal(t, []int32{2}, numbers(rows), "one location")
	rows, err = q.ListOrders(ctx, gen.ListOrdersParams{CompanyID: s.company.ID, LocationIds: []int64{}, Limit: 20})
	require.NoError(t, err)
	assert.Empty(t, rows, "no location: nothing")
	count, err := q.CountOrders(ctx, gen.CountOrdersParams{CompanyID: s.company.ID, LocationIds: only})
	require.NoError(t, err)
	assert.EqualValues(t, 1, count)

	_, err = q.GetOrder(ctx, gen.GetOrderParams{ID: inAsosiy.ID, CompanyID: s.company.ID, LocationIds: only})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "an order standing elsewhere is not read")
	got, err := q.GetOrder(ctx, gen.GetOrderParams{ID: inChilonzor.ID, CompanyID: s.company.ID, LocationIds: only})
	require.NoError(t, err)
	assert.Equal(t, chilonzor, got.LocationID)
	_, err = q.UpdateOrder(ctx, gen.UpdateOrderParams{ID: inAsosiy.ID, CompanyID: s.company.ID, LocationIds: only, Deadline: day("2026-10-12"), StageID: s.yangi.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "nor edited")
	_, err = q.MoveOrder(ctx, gen.MoveOrderParams{ID: inAsosiy.ID, CompanyID: s.company.ID, LocationIds: only, StageID: s.bajarildi.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "nor moved")
	_, err = q.DeleteOrder(ctx, gen.DeleteOrderParams{ID: inAsosiy.ID, CompanyID: s.company.ID, LocationIds: only})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "nor deleted")
	var number int32
	require.NoError(t, pool.QueryRow(ctx, "SELECT number FROM orders WHERE id = $1 AND deleted_at IS NULL", inAsosiy.ID).Scan(&number))
	assert.EqualValues(t, 1, number, "untouched")
}

// The company's next order number: one past the highest, the deleted
// orders counted; every company counts on its own.
func TestNextOrderNumber(t *testing.T) {
	q, pool := setup(t)
	s := newOrderShop(t, q, pool, "Olma")
	nok := newOrderShop(t, q, pool, "Nok")
	assert.EqualValues(t, 1, nextNumber(t, q, s.company.ID), "the first")
	s.order(t, q, "2026-10-10", nil)
	gone := s.order(t, q, "2026-10-11", nil)
	assert.EqualValues(t, 3, nextNumber(t, q, s.company.ID), "one past the highest")
	mustExec(t, pool, "UPDATE orders SET deleted_at = now() WHERE id = $1", gone.ID)
	assert.EqualValues(t, 3, nextNumber(t, q, s.company.ID), "a deleted order keeps its number taken")
	assert.EqualValues(t, 1, nextNumber(t, q, nok.company.ID), "another company counts on its own")
}

// A search of a number alone finds the order of that number
// (logic/orders.md, section 6), the number matched whole.
func TestListOrdersFindsTheNumber(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	s := newOrderShop(t, q, pool, "Olma")
	// A phone with no digit a number could be mistaken for.
	karim := createCustomer(t, q, s.company.ID, s.jismoniy.ID, "998900000000")
	// Twelve orders: a number is matched whole, not as a part (2 is not 12).
	for range 12 {
		_, err := q.CreateOrder(ctx, gen.CreateOrderParams{
			CompanyID: s.company.ID, TypeID: s.buyurtma.ID, StageID: s.yangi.ID, CustomerID: karim.ID, LocationID: s.asosiy,
			Number: nextNumber(t, q, s.company.ID), Deadline: day("2026-10-10"), CreatedBy: enteredBy,
		})
		require.NoError(t, err)
	}
	find := func(digits string) []int32 {
		rows, err := q.ListOrders(ctx, gen.ListOrdersParams{CompanyID: s.company.ID, LocationIds: []int64{s.asosiy}, Search: ptr(digits), Digits: ptr(digits), Limit: 20})
		require.NoError(t, err)
		return numbers(rows)
	}

	assert.Equal(t, []int32{2}, find("2"), "the order of the number, not the ones whose number holds the digit")
	assert.Equal(t, []int32{12}, find("12"), "matched whole")
	assert.Equal(t, []int32{1}, find("1"), "not 10, 11 or 12")
	assert.Equal(t, []int32{}, find("13"), "none of that number")
	count, err := q.CountOrders(ctx, gen.CountOrdersParams{CompanyID: s.company.ID, LocationIds: []int64{s.asosiy}, Search: ptr("2"), Digits: ptr("2")})
	require.NoError(t, err)
	assert.EqualValues(t, 1, count, "counted alike")
}
