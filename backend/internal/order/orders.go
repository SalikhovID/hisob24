package order

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/currency"
	"github.com/SalikhovID/hisob24/backend/internal/customer"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/fields"
	"github.com/SalikhovID/hisob24/backend/internal/numtext"
	"github.com/SalikhovID/hisob24/backend/internal/user"
	"github.com/SalikhovID/hisob24/backend/internal/warehouse"
)

var (
	errOrderNotFound = apperr.New(apperr.NotFound, "not_found", "Buyurtma topilmadi")
	errNoType        = invalid("Buyurtma turini tanlang")
	errNoStage       = invalid("Bosqichni tanlang")
	errNoLocation    = invalid("Lokatsiyani tanlang")
	errNoCustomer    = invalid("Mijozni tanlang")
	errNotMember     = invalid("Mas'ul kompaniya a'zosi emas")
	errNotInLocation = invalid("Mas'ul bu lokatsiyada ishlamaydi")
)

// Customer is the customer an order is of, as the order shows it: its phone
// and the name it goes by (its answer to its type's first text field), nil
// when it has none.
type Customer struct {
	ID    int64
	Phone string
	Name  *string
}

// Member is a member of the company an order is assigned to: the phone and
// the name they go by in the company now; once they have left it, the name
// of then.
type Member struct {
	Phone string
	Name  *string
}

// Order is an order of a company: what every order has, its customer, its
// assignee if any, and its answers to the fields of its type.
type Order struct {
	ID      int64
	TypeID  int64
	StageID int64
	// LocationID is the location the order stands in (logic/locations.md):
	// the one it was entered in, for good.
	LocationID int64
	Title      string
	Deadline   time.Time
	Customer   Customer
	Assignee   *Member
	Values     fields.Values
	// Amount is the order's price in its currency (CurrencyID, by Rate),
	// AmountUZS the price in so'm, Paid what was paid for the order in its
	// currency; "0.00" in so'm for an order without a document
	// (logic/orders.md, 4.3).
	Amount     string
	CurrencyID int64
	Rate       string
	AmountUZS  string
	Paid       string
	// CreatedByName is the name the member who entered the order goes by in
	// the company; nil when they go by none.
	CreatedByName *string
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

// Detail is an order on its own page: with the lines of its document, the
// payments entered for it and, when asked for, the FIFO cost of its goods
// in so'm and the profit (logic/orders.md, 4.4).
type Detail struct {
	Order
	Items     []warehouse.OrderLine
	Payments  []warehouse.OrderPayment
	CostUZS   *string
	ProfitUZS *string
}

// Detail is the order with its lines and its payments, within the scope.
func (s *Service) Detail(ctx context.Context, scope Scope, id int64) (Detail, error) {
	return detailOf(ctx, s.q, scope, id)
}

// detailOf reads the order with its answers and its money, within the scope.
func detailOf(ctx context.Context, q *gen.Queries, scope Scope, id int64) (Detail, error) {
	order, err := orderOf(ctx, q, scope, id)
	if err != nil {
		return Detail{}, err
	}
	money, err := warehouse.ReadOrderMoney(ctx, q, scope.CompanyID, id)
	if err != nil {
		return Detail{}, err
	}
	return Detail{Order: order, Items: money.Items, Payments: money.Payments}, nil
}

// Scope is where a member works (logic/locations.md): the company, and the
// locations of it they may work in. The orders a member reads, enters and
// changes are those of these locations alone.
type Scope struct {
	CompanyID   int64
	LocationIDs []int64
}

// has tells whether the location is one of the scope's.
func (sc Scope) has(locationID int64) bool {
	for _, id := range sc.LocationIDs {
		if id == locationID {
			return true
		}
	}
	return false
}

// Input is what an order is saved with, as the client sent it: the title, the
// deadline as YYYY-MM-DD, the stage, the assignee's phone if any, and the
// answers by the id of the field.
type Input struct {
	Title         string
	Deadline      string
	StageID       int64
	AssigneePhone *string
	Values        map[string]json.RawMessage
	// Money is the order's price, its lines of goods and (on entry) its
	// advance (logic/orders.md, 4.3).
	Money warehouse.OrderMoneyInput
}

// NewCustomer is a customer entered together with an order: its type, its
// phone and its answers.
type NewCustomer struct {
	TypeID int64
	Phone  string
	Values map[string]json.RawMessage
}

// CustomerInput names an order's customer: one that is there (ID), or one to
// enter with the order (New).
type CustomerInput struct {
	ID  *int64
	New *NewCustomer
}

// Create enters an order of the company's type for a customer, in a location
// of the scope, with the answers to the type's fields; a new customer is
// entered with it, in the same transaction, and so is the order's money
// (its price, its goods out of the stock, its advance) as its document. by
// is the phone of the member who enters it. What is wrong is told in this
// order: the title, the deadline, the location, the type, the stage, the
// assignee, the answers, the customer, the money, the stock.
func (s *Service) Create(ctx context.Context, scope Scope, by string, typeID, locationID int64, in Input, cust CustomerInput) (Order, error) {
	companyID := scope.CompanyID
	title, err := orderTitle(in.Title)
	if err != nil {
		return Order{}, err
	}
	deadline, err := orderDeadline(in.Deadline)
	if err != nil {
		return Order{}, err
	}
	// The location is one the member works in: the scope's are the
	// company's live ones, every one of them or the restriction's.
	if !scope.has(locationID) {
		return Order{}, errNoLocation
	}
	var t Order
	err = s.write(ctx, companyID, func(q *gen.Queries) error {
		_, err := q.GetOrderType(ctx, gen.GetOrderTypeParams{ID: typeID, CompanyID: companyID})
		if errors.Is(err, pgx.ErrNoRows) {
			return errNoType
		}
		if err != nil {
			return err
		}
		if _, err := stageOf(ctx, q, companyID, in.StageID); err != nil {
			return err
		}
		who, err := assigneeOf(ctx, q, companyID, locationID, in.AssigneePhone)
		if err != nil {
			return err
		}
		form, options, err := formOf(ctx, q, companyID, typeID)
		if err != nil {
			return err
		}
		values, err := fields.CheckValues(form, options, nil, in.Values)
		if err != nil {
			return err
		}
		customerID, err := s.customerOf(ctx, q, companyID, by, cust)
		if err != nil {
			return err
		}
		name, err := memberName(ctx, q, companyID, by)
		if err != nil {
			return err
		}
		row, err := q.CreateOrder(ctx, gen.CreateOrderParams{
			CompanyID: companyID, TypeID: typeID, StageID: in.StageID, CustomerID: customerID, LocationID: locationID, Title: title, Deadline: deadline,
			AssigneePhone: who.phone, AssigneeName: who.name, CreatedBy: by, CreatedByName: name,
		})
		if err != nil {
			return err
		}
		if err := store(ctx, q, row.ID, form, values); err != nil {
			return err
		}
		err = q.AddOrderHistory(ctx, gen.AddOrderHistoryParams{
			OrderID: row.ID, Action: "created", ActorPhone: by, ActorName: name, Changes: []byte("[]"),
		})
		if err != nil {
			return err
		}
		// The money last (logic/orders.md, 4.1): the price, the lines out of
		// the location's stock and the advance, as the order's document.
		head := warehouse.OrderHead{ID: row.ID, CustomerID: customerID, LocationID: locationID}
		if _, err := warehouse.WriteOrderDocument(ctx, q, companyID, by, name, head, in.Money, true); err != nil {
			return err
		}
		t, err = orderOf(ctx, q, scope, row.ID)
		return err
	})
	if err != nil {
		return Order{}, err
	}
	return t, nil
}

// assignee is who an order is assigned to, as it is kept: the phone and the
// name they go by now; none when the order is assigned to nobody.
type assignee struct {
	phone, name *string
}

// assigneeOf reads the phone a client sent as the assignee: nil or empty for
// nobody, otherwise a member of the company who works in the order's
// location (logic/locations.md, section 6).
func assigneeOf(ctx context.Context, q *gen.Queries, companyID, locationID int64, raw *string) (assignee, error) {
	if raw == nil || strings.TrimSpace(*raw) == "" {
		return assignee{}, nil
	}
	phone, err := user.NormalizePhone(*raw)
	if err != nil {
		return assignee{}, errNotMember
	}
	name, err := q.GetMemberName(ctx, gen.GetMemberNameParams{UserPhone: phone, CompanyID: companyID})
	if errors.Is(err, pgx.ErrNoRows) {
		return assignee{}, errNotMember
	}
	if err != nil {
		return assignee{}, err
	}
	works, err := q.MemberInLocation(ctx, gen.MemberInLocationParams{UserPhone: phone, CompanyID: companyID, LocationID: locationID})
	if err != nil {
		return assignee{}, err
	}
	if !works {
		return assignee{}, errNotInLocation
	}
	return assignee{phone: &phone, name: name}, nil
}

// sameAssignee tells whether the phone a client sent names the member the
// order is assigned to already (or nobody, when it is assigned to nobody).
func sameAssignee(raw *string, was *Member) bool {
	if raw == nil || strings.TrimSpace(*raw) == "" {
		return was == nil
	}
	phone, err := user.NormalizePhone(*raw)
	return err == nil && was != nil && was.Phone == phone
}

// nameOf is a name as the history writes it: "" for none.
func nameOf(name *string) string {
	if name == nil {
		return ""
	}
	return *name
}

// stageOf is the company's stage, or the refusal to take one that is not.
func stageOf(ctx context.Context, q *gen.Queries, companyID, id int64) (gen.OrderStage, error) {
	st, err := q.GetOrderStage(ctx, gen.GetOrderStageParams{ID: id, CompanyID: companyID})
	if errors.Is(err, pgx.ErrNoRows) {
		return gen.OrderStage{}, errNoStage
	}
	return st, err
}

// stageName is the name of the stage an order stands in, "" once the stage is
// gone.
func stageName(ctx context.Context, q *gen.Queries, companyID, id int64) (string, error) {
	st, err := q.GetOrderStage(ctx, gen.GetOrderStageParams{ID: id, CompanyID: companyID})
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	return st.Name, err
}

// customerOf is the order's customer: the one named, which has to be the
// company's own and not deleted, or the new one entered with the order.
func (s *Service) customerOf(ctx context.Context, q *gen.Queries, companyID int64, by string, cust CustomerInput) (int64, error) {
	switch {
	case cust.ID != nil:
		_, err := q.GetCustomer(ctx, gen.GetCustomerParams{ID: *cust.ID, CompanyID: companyID})
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, errNoCustomer
		}
		return *cust.ID, err
	case cust.New != nil:
		c, err := s.customers.CreateIn(ctx, q, companyID, by, cust.New.TypeID, customer.Input{Phone: cust.New.Phone, Values: cust.New.Values})
		if err != nil {
			return 0, err
		}
		return c.ID, nil
	}
	return 0, errNoCustomer
}

// memberName is the name the user goes by in the company now: what is kept
// beside what they do to its orders. None for a member without a name, and
// for a user the company has let go meanwhile.
func memberName(ctx context.Context, q *gen.Queries, companyID int64, phone string) (*string, error) {
	name, err := q.GetMemberName(ctx, gen.GetMemberNameParams{UserPhone: phone, CompanyID: companyID})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return name, err
}

// formOf is what the form of a type asks and offers: the type's fields in
// their order, and the options of the company's dropdowns, each dropdown's
// in its order.
func formOf(ctx context.Context, q *gen.Queries, companyID, typeID int64) ([]Field, map[int64][]fields.Option, error) {
	all, err := q.ListOrderFields(ctx, companyID)
	if err != nil {
		return nil, nil, err
	}
	var form []Field
	for _, f := range all {
		if f.TypeID == typeID {
			form = append(form, toField(f))
		}
	}
	rows, err := q.ListCustomerDropdownOptions(ctx, companyID)
	if err != nil {
		return nil, nil, err
	}
	options := map[int64][]fields.Option{}
	for _, o := range rows {
		options[o.DropdownID] = append(options[o.DropdownID], fields.Option{ID: o.ID, Label: o.Label, Active: o.IsActive})
	}
	return form, options, nil
}

// store writes an order's answers to the fields.
func store(ctx context.Context, q *gen.Queries, orderID int64, form []Field, values fields.Values) error {
	for _, f := range form {
		for _, row := range valueRows(f, values[f.ID]) {
			row.OrderID = orderID
			if err := q.AddOrderValue(ctx, row); err != nil {
				return err
			}
		}
	}
	return nil
}

// valueRows is an answer as it is stored: a row for a text or a number, a
// row for each option chosen, none for no answer.
func valueRows(f Field, answer any) []gen.AddOrderValueParams {
	switch a := answer.(type) {
	case string:
		return []gen.AddOrderValueParams{{FieldID: f.ID, TextValue: &a}}
	case int64:
		if choice, _ := fields.KindOf(f.Kind); choice {
			return []gen.AddOrderValueParams{{FieldID: f.ID, OptionID: &a}}
		}
		return []gen.AddOrderValueParams{{FieldID: f.ID, IntValue: &a}}
	case []int64:
		rows := make([]gen.AddOrderValueParams, 0, len(a))
		for _, id := range a {
			rows = append(rows, gen.AddOrderValueParams{FieldID: f.ID, OptionID: &id})
		}
		return rows
	}
	return nil
}

// answersOf reads the answers of the orders named; an order with none gets an
// empty set.
func answersOf(ctx context.Context, q *gen.Queries, ids []int64) (map[int64]fields.Values, error) {
	rows, err := q.ListOrderValues(ctx, ids)
	if err != nil {
		return nil, err
	}
	of := make(map[int64]fields.Values, len(ids))
	for _, id := range ids {
		of[id] = fields.Values{}
	}
	for _, r := range rows {
		values := of[r.OrderID]
		switch {
		case r.TextValue != nil:
			values[r.FieldID] = *r.TextValue
		case r.IntValue != nil:
			values[r.FieldID] = *r.IntValue
		case r.Kind == fields.KindDropdown || r.Kind == fields.KindRadio:
			values[r.FieldID] = *r.OptionID
		default:
			chosen, _ := values[r.FieldID].([]int64)
			values[r.FieldID] = append(chosen, *r.OptionID)
		}
	}
	return of, nil
}

// orderOf reads the order with its answers, within the scope: an order standing
// in a location outside it is not found.
func orderOf(ctx context.Context, q *gen.Queries, scope Scope, id int64) (Order, error) {
	row, err := q.GetOrder(ctx, gen.GetOrderParams{ID: id, CompanyID: scope.CompanyID, LocationIds: scope.LocationIDs})
	if errors.Is(err, pgx.ErrNoRows) {
		return Order{}, errOrderNotFound
	}
	if err != nil {
		return Order{}, err
	}
	answers, err := answersOf(ctx, q, []int64{id})
	if err != nil {
		return Order{}, err
	}
	return toOrder(row, answers[id]), nil
}

// toOrder is an order as the queries read it, with its answers.
func toOrder(row gen.GetOrderRow, values fields.Values) Order {
	t := Order{
		ID: row.ID, TypeID: row.TypeID, StageID: row.StageID, LocationID: row.LocationID, Title: row.Title, Deadline: row.Deadline,
		Customer:      Customer{ID: row.CustomerID, Phone: row.CustomerPhone, Name: row.CustomerName},
		Values:        values,
		Amount:        money(row.Amount), CurrencyID: row.CurrencyID, Rate: currency.RateText(row.Rate), AmountUZS: money(row.AmountUzs), Paid: money(row.Paid),
		CreatedByName: row.CreatedByName, CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt,
	}
	if row.AssigneePhone != nil {
		t.Assignee = &Member{Phone: *row.AssigneePhone, Name: row.AssigneeName}
	}
	return t
}

// money is a stored amount as the API shows it, "0.00" for none.
func money(n pgtype.Numeric) string {
	if s := numtext.Amount(n); s != nil {
		return *s
	}
	return "0.00"
}

// Get is the order with its answers, within the scope.
func (s *Service) Get(ctx context.Context, scope Scope, id int64) (Order, error) {
	return orderOf(ctx, s.q, scope, id)
}

// PageSize is how many orders a page of the list holds.
const PageSize = 20

// maxPage keeps the offset inside int32.
const maxPage = 1_000_000

// ListInput narrows the list of orders: Search is looked for in the titles,
// in the text answers of the orders and of their customers, and (as a number)
// in the customers' phones and the whole number answers; LocationID, TypeID,
// StageID, CustomerID and Assignee (a phone) each keep one, 0 or "" leaves
// the filter out (every location of the scope). Page starts at 1.
type ListInput struct {
	Search     string
	LocationID int64
	TypeID     int64
	StageID    int64
	CustomerID int64
	Assignee   string
	Page       int
}

// Page is one page of orders and how many there are on all of them.
type Page struct {
	Items    []Order
	Total    int64
	Page     int
	PageSize int
}

// List is a page of the orders of the scope's locations (of the one named
// alone, when one is; one outside the scope has none), the one due soonest
// first.
func (s *Service) List(ctx context.Context, scope Scope, in ListInput) (Page, error) {
	if in.Page < 1 || in.Page > maxPage {
		return Page{}, invalid("Sahifa raqami noto'g'ri")
	}
	companyID := scope.CompanyID
	locations := scope.LocationIDs
	if in.LocationID != 0 {
		locations = []int64{}
		if scope.has(in.LocationID) {
			locations = []int64{in.LocationID}
		}
	}
	only := func(id int64) *int64 {
		if id == 0 {
			return nil
		}
		return &id
	}
	var assignee *string
	if in.Assignee != "" {
		phone, err := user.NormalizePhone(in.Assignee)
		if err != nil {
			return Page{}, invalid("Mas'ul noto'g'ri")
		}
		assignee = &phone
	}
	search, digits := customer.SearchOf(in.Search)
	total, err := s.q.CountOrders(ctx, gen.CountOrdersParams{
		CompanyID: companyID, LocationIds: locations, TypeID: only(in.TypeID), StageID: only(in.StageID), AssigneePhone: assignee, CustomerID: only(in.CustomerID),
		Search: search, Digits: digits,
	})
	if err != nil {
		return Page{}, err
	}
	rows, err := s.q.ListOrders(ctx, gen.ListOrdersParams{
		CompanyID: companyID, LocationIds: locations, TypeID: only(in.TypeID), StageID: only(in.StageID), AssigneePhone: assignee, CustomerID: only(in.CustomerID),
		Search: search, Digits: digits, Limit: PageSize, Offset: int32((in.Page - 1) * PageSize),
	})
	if err != nil {
		return Page{}, err
	}
	ids := make([]int64, 0, len(rows))
	for _, row := range rows {
		ids = append(ids, row.ID)
	}
	answers, err := answersOf(ctx, s.q, ids)
	if err != nil {
		return Page{}, err
	}
	items := make([]Order, 0, len(rows))
	for _, row := range rows {
		items = append(items, toOrder(gen.GetOrderRow(row), answers[row.ID]))
	}
	return Page{Items: items, Total: total, Page: in.Page, PageSize: PageSize}, nil
}

// Update saves the order (within the scope) with another title, deadline,
// stage, assignee, answers, price and lines (its payments are left alone:
// they are entered on their own, logic/orders.md, 4.3); its type, customer
// and location stay. The
// assignee it has stays as they are, a member no more too; another one has
// to be a member who works in the order's location. by is the phone of the
// member who edits it.
func (s *Service) Update(ctx context.Context, scope Scope, id int64, by string, in Input) (Order, error) {
	companyID := scope.CompanyID
	var t Order
	err := s.write(ctx, companyID, func(q *gen.Queries) error {
		was, err := orderOf(ctx, q, scope, id)
		if err != nil {
			return err
		}
		title, err := orderTitle(in.Title)
		if err != nil {
			return err
		}
		deadline, err := orderDeadline(in.Deadline)
		if err != nil {
			return err
		}
		stage, err := stageOf(ctx, q, companyID, in.StageID)
		if err != nil {
			return err
		}
		var who assignee
		if sameAssignee(in.AssigneePhone, was.Assignee) {
			if was.Assignee != nil {
				who = assignee{phone: &was.Assignee.Phone, name: was.Assignee.Name}
			}
		} else if who, err = assigneeOf(ctx, q, companyID, was.LocationID, in.AssigneePhone); err != nil {
			return err
		}
		form, options, err := formOf(ctx, q, companyID, was.TypeID)
		if err != nil {
			return err
		}
		values, err := fields.CheckValues(form, options, was.Values, in.Values)
		if err != nil {
			return err
		}
		// The money after the order's own fields (logic/orders.md, 4.1): the
		// document is saved anew, its payments left alone.
		wasMoney, err := warehouse.ReadOrderMoney(ctx, q, companyID, id)
		if err != nil {
			return err
		}
		name, err := memberName(ctx, q, companyID, by)
		if err != nil {
			return err
		}
		nowMoney, err := warehouse.WriteOrderDocument(ctx, q, companyID, by, name, warehouse.OrderHead{ID: id, CustomerID: was.Customer.ID, LocationID: was.LocationID}, in.Money, false)
		if err != nil {
			return err
		}
		wasStage, err := stageName(ctx, q, companyID, was.StageID)
		if err != nil {
			return err
		}
		var wasAssignee string
		if was.Assignee != nil {
			wasAssignee = nameOf(was.Assignee.Name)
		}
		changed := diffHead(
			head{Title: was.Title, Deadline: was.Deadline, Stage: wasStage, Assignee: wasAssignee},
			head{Title: title, Deadline: deadline, Stage: stage.Name, Assignee: nameOf(who.name)},
		)
		changed = append(changed, fields.DiffValues(form, options, was.Values, values)...)
		changed = append(changed, diffMoney(wasMoney, nowMoney)...)
		if len(changed) == 0 {
			// Nothing to save, and nothing for the history.
			t = was
			return nil
		}
		_, err = q.UpdateOrder(ctx, gen.UpdateOrderParams{
			ID: id, CompanyID: companyID, LocationIds: scope.LocationIDs, Title: title, Deadline: deadline, StageID: stage.ID,
			AssigneePhone: who.phone, AssigneeName: who.name,
		})
		if err != nil {
			return err
		}
		if err := q.DeleteOrderValues(ctx, id); err != nil {
			return err
		}
		if err := store(ctx, q, id, form, values); err != nil {
			return err
		}
		if err := s.record(ctx, q, companyID, id, "updated", by, changed); err != nil {
			return err
		}
		t, err = orderOf(ctx, q, scope, id)
		return err
	})
	if err != nil {
		return Order{}, err
	}
	return t, nil
}

// record writes down what a member did to an order.
func (s *Service) record(ctx context.Context, q *gen.Queries, companyID, orderID int64, action, by string, changed []fields.Change) error {
	if changed == nil {
		changed = []fields.Change{}
	}
	changes, err := json.Marshal(changed)
	if err != nil {
		return err
	}
	name, err := memberName(ctx, q, companyID, by)
	if err != nil {
		return err
	}
	return q.AddOrderHistory(ctx, gen.AddOrderHistoryParams{
		OrderID: orderID, Action: action, ActorPhone: by, ActorName: name, Changes: changes,
	})
}

// Move puts the order (within the scope) in another stage; the same stage
// changes nothing. by is the phone of the member who moves it.
func (s *Service) Move(ctx context.Context, scope Scope, id int64, by string, stageID int64) (Order, error) {
	companyID := scope.CompanyID
	var t Order
	err := s.write(ctx, companyID, func(q *gen.Queries) error {
		was, err := orderOf(ctx, q, scope, id)
		if err != nil {
			return err
		}
		if was.StageID == stageID {
			t = was
			return nil
		}
		stage, err := stageOf(ctx, q, companyID, stageID)
		if err != nil {
			return err
		}
		wasStage, err := stageName(ctx, q, companyID, was.StageID)
		if err != nil {
			return err
		}
		if _, err := q.MoveOrder(ctx, gen.MoveOrderParams{ID: id, CompanyID: companyID, LocationIds: scope.LocationIDs, StageID: stageID}); err != nil {
			return err
		}
		changed := []fields.Change{{Label: "Bosqich", Old: wasStage, New: stage.Name}}
		if err := s.record(ctx, q, companyID, id, "updated", by, changed); err != nil {
			return err
		}
		t, err = orderOf(ctx, q, scope, id)
		return err
	})
	if err != nil {
		return Order{}, err
	}
	return t, nil
}

// Delete hides the order (within the scope) and its document (its goods
// come back to the stock, its payments go): it is gone from the app, and
// nothing is removed. by is the phone of the member who deletes it.
func (s *Service) Delete(ctx context.Context, scope Scope, id int64, by string) error {
	companyID := scope.CompanyID
	return s.write(ctx, companyID, func(q *gen.Queries) error {
		_, err := q.DeleteOrder(ctx, gen.DeleteOrderParams{ID: id, CompanyID: companyID, LocationIds: scope.LocationIDs})
		if errors.Is(err, pgx.ErrNoRows) {
			return errOrderNotFound
		}
		if err != nil {
			return err
		}
		if err := warehouse.DeleteOrderDocument(ctx, q, companyID, id); err != nil {
			return err
		}
		return s.record(ctx, q, companyID, id, "deleted", by, nil)
	})
}

// HistoryEntry is one thing that happened to an order: it was created, updated
// (moved too) or deleted, by whom and when. Changes is what an edit changed.
type HistoryEntry struct {
	ID     int64
	Action string
	// ActorName is the name the member who did it goes by in the company;
	// nil when they go by none.
	ActorName *string
	CreatedAt time.Time
	Changes   []fields.Change
}

// History is what happened to the order (within the scope), the latest first.
func (s *Service) History(ctx context.Context, scope Scope, id int64) ([]HistoryEntry, error) {
	_, err := s.q.GetOrder(ctx, gen.GetOrderParams{ID: id, CompanyID: scope.CompanyID, LocationIds: scope.LocationIDs})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, errOrderNotFound
	}
	if err != nil {
		return nil, err
	}
	rows, err := s.q.ListOrderHistory(ctx, id)
	if err != nil {
		return nil, err
	}
	history := make([]HistoryEntry, 0, len(rows))
	for _, row := range rows {
		e := HistoryEntry{ID: row.ID, Action: row.Action, ActorName: row.ActorName, CreatedAt: row.CreatedAt, Changes: []fields.Change{}}
		if err := json.Unmarshal(row.Changes, &e.Changes); err != nil {
			return nil, err
		}
		history = append(history, e)
	}
	return history, nil
}

// Upcoming is the orders of the scope's locations (of the one named alone,
// when one is; one outside the scope has none) in a stage not done yet,
// the one due soonest first, as many as limit: the home's «Yaqin
// muddatlar».
func (s *Service) Upcoming(ctx context.Context, scope Scope, locationID int64, limit int) ([]Order, error) {
	locations := scope.LocationIDs
	if locationID != 0 {
		locations = []int64{}
		if scope.has(locationID) {
			locations = []int64{locationID}
		}
	}
	rows, err := s.q.ListActiveOrders(ctx, gen.ListActiveOrdersParams{CompanyID: scope.CompanyID, LocationIds: locations, Limit: int32(limit)})
	if err != nil {
		return nil, err
	}
	ids := make([]int64, 0, len(rows))
	for _, row := range rows {
		ids = append(ids, row.ID)
	}
	answers, err := answersOf(ctx, s.q, ids)
	if err != nil {
		return nil, err
	}
	items := make([]Order, 0, len(rows))
	for _, row := range rows {
		items = append(items, toOrder(gen.GetOrderRow(row), answers[row.ID]))
	}
	return items, nil
}
