package app

import (
	"net/http"
	"strconv"
	"time"

	"github.com/SalikhovID/hisob24/backend/internal/httpx"
	"github.com/SalikhovID/hisob24/backend/internal/ledger"
	"github.com/SalikhovID/hisob24/backend/internal/warehouse"
)

// The stock documents besides the purchases (logic/warehouse.md, section
// 5): transfers, inventories and opening stock, the stock at a moment, a
// product's moves; and the opening balances of a supplier (section 6).

type moveInputJSON struct {
	ProductID int64   `json:"product_id"`
	Quantity  *string `json:"quantity"`
}

type transferItemJSON struct {
	ProductID int64   `json:"product_id"`
	Name      string  `json:"name"`
	Unit      *string `json:"unit"`
	Quantity  string  `json:"quantity"`
}

type transferJSON struct {
	ID             int64     `json:"id"`
	Number         int32     `json:"number"`
	LocationID     int64     `json:"location_id"`
	LocationName   string    `json:"location_name"`
	ToLocationID   int64     `json:"to_location_id"`
	ToLocationName string    `json:"to_location_name"`
	At             time.Time `json:"at"`
	Note           *string   `json:"note"`
	ItemsCount     int64     `json:"items_count"`
	CreatedByName  *string   `json:"created_by_name"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
	// Items are the lines, on the transfer's own page; a list carries none.
	Items []transferItemJSON `json:"items,omitempty"`
}

func toTransferJSON(t warehouse.Transfer) transferJSON {
	out := transferJSON{
		ID: t.ID, Number: t.Number, LocationID: t.LocationID, LocationName: t.LocationName, ToLocationID: t.ToLocationID, ToLocationName: t.ToLocationName,
		At: t.At, Note: t.Note, ItemsCount: t.ItemsCount, CreatedByName: t.CreatedByName, CreatedAt: t.CreatedAt, UpdatedAt: t.UpdatedAt,
	}
	for _, it := range t.Items {
		out.Items = append(out.Items, transferItemJSON{ProductID: it.ProductID, Name: it.Name, Unit: it.Unit, Quantity: it.Quantity})
	}
	return out
}

type transferInputJSON struct {
	ToLocationID int64           `json:"to_location_id"`
	At           string          `json:"at"`
	Note         *string         `json:"note"`
	Items        []moveInputJSON `json:"items"`
}

func (in transferInputJSON) input() warehouse.TransferInput {
	items := make([]warehouse.ItemInput, 0, len(in.Items))
	for _, it := range in.Items {
		items = append(items, warehouse.ItemInput{ProductID: it.ProductID, Quantity: it.Quantity})
	}
	return warehouse.TransferInput{ToLocationID: in.ToLocationID, At: in.At, Note: in.Note, Items: items}
}

// transferCreateJSON is a transfer as it is entered: with the location it
// comes out of.
type transferCreateJSON struct {
	transferInputJSON
	LocationID int64 `json:"location_id"`
}

type countInputJSON struct {
	ProductID int64   `json:"product_id"`
	Counted   *string `json:"counted"`
}

type inventoryItemJSON struct {
	ProductID  int64   `json:"product_id"`
	Name       string  `json:"name"`
	Unit       *string `json:"unit"`
	Expected   string  `json:"expected"`
	Counted    string  `json:"counted"`
	Difference string  `json:"difference"`
}

type inventoryJSON struct {
	ID            int64     `json:"id"`
	Number        int32     `json:"number"`
	LocationID    int64     `json:"location_id"`
	LocationName  string    `json:"location_name"`
	At            time.Time `json:"at"`
	Note          *string   `json:"note"`
	ItemsCount    int64     `json:"items_count"`
	CreatedByName *string   `json:"created_by_name"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
	// Items are the lines, on the inventory's own page; a list carries none.
	Items []inventoryItemJSON `json:"items,omitempty"`
}

func toInventoryJSON(i warehouse.Inventory) inventoryJSON {
	out := inventoryJSON{
		ID: i.ID, Number: i.Number, LocationID: i.LocationID, LocationName: i.LocationName, At: i.At, Note: i.Note, ItemsCount: i.ItemsCount,
		CreatedByName: i.CreatedByName, CreatedAt: i.CreatedAt, UpdatedAt: i.UpdatedAt,
	}
	for _, it := range i.Items {
		out.Items = append(out.Items, inventoryItemJSON{ProductID: it.ProductID, Name: it.Name, Unit: it.Unit, Expected: it.Expected, Counted: it.Counted, Difference: it.Difference})
	}
	return out
}

type inventoryInputJSON struct {
	At    string           `json:"at"`
	Note  *string          `json:"note"`
	Items []countInputJSON `json:"items"`
}

func (in inventoryInputJSON) input() warehouse.InventoryInput {
	items := make([]warehouse.ItemInput, 0, len(in.Items))
	for _, it := range in.Items {
		items = append(items, warehouse.ItemInput{ProductID: it.ProductID, Quantity: it.Counted})
	}
	return warehouse.InventoryInput{At: in.At, Note: in.Note, Items: items}
}

// inventoryCreateJSON is an inventory as it is entered: with the location
// counted.
type inventoryCreateJSON struct {
	inventoryInputJSON
	LocationID int64 `json:"location_id"`
}

type openingStockJSON struct {
	ID            int64     `json:"id"`
	Number        int32     `json:"number"`
	LocationID    int64     `json:"location_id"`
	LocationName  string    `json:"location_name"`
	At            time.Time `json:"at"`
	CurrencyID    int64     `json:"currency_id"`
	Rate          string    `json:"rate"`
	Note          *string   `json:"note"`
	Total         string    `json:"total"`
	TotalUZS      string    `json:"total_uzs"`
	ItemsCount    int64     `json:"items_count"`
	CreatedByName *string   `json:"created_by_name"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
	// Items are the lines, on the document's own page; a list carries none.
	Items []itemJSON `json:"items,omitempty"`
}

func toOpeningStockJSON(o warehouse.OpeningStock) openingStockJSON {
	out := openingStockJSON{
		ID: o.ID, Number: o.Number, LocationID: o.LocationID, LocationName: o.LocationName, At: o.At, CurrencyID: o.CurrencyID, Rate: o.Rate, Note: o.Note,
		Total: o.Total, TotalUZS: o.TotalUZS, ItemsCount: o.ItemsCount, CreatedByName: o.CreatedByName, CreatedAt: o.CreatedAt, UpdatedAt: o.UpdatedAt,
	}
	for _, it := range o.Items {
		out.Items = append(out.Items, itemJSON{ProductID: it.ProductID, Name: it.Name, Unit: it.Unit, Quantity: it.Quantity, Price: it.Price, Amount: it.Amount})
	}
	return out
}

type openingStockInputJSON struct {
	At         string          `json:"at"`
	CurrencyID *int64          `json:"currency_id"`
	Rate       *string         `json:"rate"`
	Note       *string         `json:"note"`
	Items      []itemInputJSON `json:"items"`
}

func (in openingStockInputJSON) input() warehouse.OpeningStockInput {
	items := make([]warehouse.ItemInput, 0, len(in.Items))
	for _, it := range in.Items {
		items = append(items, warehouse.ItemInput{ProductID: it.ProductID, Quantity: it.Quantity, Price: it.Price})
	}
	return warehouse.OpeningStockInput{At: in.At, CurrencyID: in.CurrencyID, Rate: in.Rate, Note: in.Note, Items: items}
}

// openingStockCreateJSON is an opening stock as it is entered: with the
// location it lands in.
type openingStockCreateJSON struct {
	openingStockInputJSON
	LocationID int64 `json:"location_id"`
}

type stockRowJSON struct {
	ProductID int64   `json:"product_id"`
	Name      string  `json:"name"`
	Unit      *string `json:"unit"`
	Quantity  string  `json:"quantity"`
}

type productMoveJSON struct {
	ID            int64     `json:"id"`
	TransactionID int64     `json:"transaction_id"`
	Kind          string    `json:"kind"`
	Number        int32     `json:"number"`
	At            time.Time `json:"at"`
	LocationID    int64     `json:"location_id"`
	LocationName  string    `json:"location_name"`
	Quantity      string    `json:"quantity"`
	Counterpart   *string   `json:"counterpart"`
	OrderID       *int64    `json:"order_id"`
	OrderTitle    *string   `json:"order_title"`
}

type openingJSON struct {
	ID            int64     `json:"id"`
	Kind          string    `json:"kind"`
	SupplierID    int64     `json:"supplier_id"`
	Amount        string    `json:"amount"`
	CurrencyID    int64     `json:"currency_id"`
	Rate          string    `json:"rate"`
	AmountUZS     string    `json:"amount_uzs"`
	At            time.Time `json:"at"`
	Note          *string   `json:"note"`
	CreatedByName *string   `json:"created_by_name"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

func toOpeningJSON(o warehouse.Opening) openingJSON {
	return openingJSON{
		ID: o.ID, Kind: o.Kind, SupplierID: o.SupplierID, Amount: o.Amount, CurrencyID: o.CurrencyID, Rate: o.Rate, AmountUZS: o.AmountUZS, At: o.At, Note: o.Note,
		CreatedByName: o.CreatedByName, CreatedAt: o.CreatedAt, UpdatedAt: o.UpdatedAt,
	}
}

type openingInputJSON struct {
	Kind       string  `json:"kind"`
	Amount     *string `json:"amount"`
	CurrencyID *int64  `json:"currency_id"`
	Rate       *string `json:"rate"`
	At         string  `json:"at"`
	Note       *string `json:"note"`
}

func (in openingInputJSON) input() warehouse.OpeningInput {
	return warehouse.OpeningInput{Kind: in.Kind, Amount: in.Amount, CurrencyID: in.CurrencyID, Rate: in.Rate, At: in.At, Note: in.Note}
}

// documentListParams reads ?location_id= and ?page= of a list of stock
// documents (the rules of locationParam and pageParam).
func documentListParams(w http.ResponseWriter, r *http.Request) (warehouse.DocumentListInput, bool) {
	locationID, ok := locationParam(w, r)
	if !ok {
		return warehouse.DocumentListInput{}, false
	}
	page, ok := pageParam(w, r)
	if !ok {
		return warehouse.DocumentListInput{}, false
	}
	return warehouse.DocumentListInput{LocationID: locationID, Page: page}, true
}

// entryLocation reads the location a document is entered into: none is
// refused (400), one the member may not work in too (403).
func entryLocation(w http.ResponseWriter, r *http.Request, locationID int64) bool {
	if locationID == 0 {
		httpx.Error(w, http.StatusBadRequest, "validation_error", "Lokatsiyani tanlang")
		return false
	}
	if !allowedLocation(r, locationID) {
		forbidden(w)
		return false
	}
	return true
}

// listTransfers is a page of the transfers out of or into the member's
// locations, or the one ?location_id= names, the newest first.
func (h *Handler) listTransfers(w http.ResponseWriter, r *http.Request) {
	in, ok := documentListParams(w, r)
	if !ok {
		return
	}
	result, err := h.warehouse.ListTransfers(r.Context(), warehouseScope(r), in)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	items := make([]transferJSON, 0, len(result.Items))
	for _, t := range result.Items {
		items = append(items, toTransferJSON(t))
	}
	httpx.JSON(w, http.StatusOK, pageJSON[transferJSON]{Items: items, Total: result.Total, Page: result.Page, PageSize: result.PageSize})
}

// createTransfer moves products out of a location the member works in into
// another of the company's, as the member the session is of.
func (h *Handler) createTransfer(w http.ResponseWriter, r *http.Request) {
	var body transferCreateJSON
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	if !entryLocation(w, r, body.LocationID) {
		return
	}
	t, err := h.warehouse.CreateTransfer(r.Context(), warehouseScope(r), currentUser(r.Context()).Phone, body.LocationID, body.input())
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, toTransferJSON(t))
}

// getTransfer is a transfer out of or into the member's locations, with its lines.
func (h *Handler) getTransfer(w http.ResponseWriter, r *http.Request) {
	t, err := h.warehouse.GetTransfer(r.Context(), warehouseScope(r), pathID(r, "id"))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toTransferJSON(t))
}

// updateTransfer saves a transfer out of the member's locations with
// another destination, moment, lines and note.
func (h *Handler) updateTransfer(w http.ResponseWriter, r *http.Request) {
	var body transferInputJSON
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	t, err := h.warehouse.UpdateTransfer(r.Context(), warehouseScope(r), pathID(r, "id"), body.input())
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toTransferJSON(t))
}

// deleteTransfer hides a transfer out of the member's locations and takes
// its moves back.
func (h *Handler) deleteTransfer(w http.ResponseWriter, r *http.Request) {
	if err := h.warehouse.DeleteTransfer(r.Context(), warehouseScope(r), pathID(r, "id")); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// listInventories is a page of the inventories of the member's locations,
// or of the one ?location_id= names, the newest first.
func (h *Handler) listInventories(w http.ResponseWriter, r *http.Request) {
	in, ok := documentListParams(w, r)
	if !ok {
		return
	}
	result, err := h.warehouse.ListInventories(r.Context(), warehouseScope(r), in)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	items := make([]inventoryJSON, 0, len(result.Items))
	for _, i := range result.Items {
		items = append(items, toInventoryJSON(i))
	}
	httpx.JSON(w, http.StatusOK, pageJSON[inventoryJSON]{Items: items, Total: result.Total, Page: result.Page, PageSize: result.PageSize})
}

// createInventory enters a count of a location the member works in, as the
// member the session is of.
func (h *Handler) createInventory(w http.ResponseWriter, r *http.Request) {
	var body inventoryCreateJSON
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	if !entryLocation(w, r, body.LocationID) {
		return
	}
	i, err := h.warehouse.CreateInventory(r.Context(), warehouseScope(r), currentUser(r.Context()).Phone, body.LocationID, body.input())
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, toInventoryJSON(i))
}

// getInventory is an inventory of the member's locations, with its lines.
func (h *Handler) getInventory(w http.ResponseWriter, r *http.Request) {
	i, err := h.warehouse.GetInventory(r.Context(), warehouseScope(r), pathID(r, "id"))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toInventoryJSON(i))
}

// updateInventory saves an inventory of the member's locations with another
// moment, lines and note; what was expected is counted anew.
func (h *Handler) updateInventory(w http.ResponseWriter, r *http.Request) {
	var body inventoryInputJSON
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	i, err := h.warehouse.UpdateInventory(r.Context(), warehouseScope(r), pathID(r, "id"), body.input())
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toInventoryJSON(i))
}

// deleteInventory hides an inventory of the member's locations and takes
// its moves back.
func (h *Handler) deleteInventory(w http.ResponseWriter, r *http.Request) {
	if err := h.warehouse.DeleteInventory(r.Context(), warehouseScope(r), pathID(r, "id")); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// listOpeningStock is a page of the opening stocks of the member's
// locations, or of the one ?location_id= names, the newest first.
func (h *Handler) listOpeningStock(w http.ResponseWriter, r *http.Request) {
	in, ok := documentListParams(w, r)
	if !ok {
		return
	}
	result, err := h.warehouse.ListOpeningStock(r.Context(), warehouseScope(r), in)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	items := make([]openingStockJSON, 0, len(result.Items))
	for _, o := range result.Items {
		items = append(items, toOpeningStockJSON(o))
	}
	httpx.JSON(w, http.StatusOK, pageJSON[openingStockJSON]{Items: items, Total: result.Total, Page: result.Page, PageSize: result.PageSize})
}

// createOpeningStock enters the stock a location the member works in starts
// with, as the member the session is of.
func (h *Handler) createOpeningStock(w http.ResponseWriter, r *http.Request) {
	var body openingStockCreateJSON
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	if !entryLocation(w, r, body.LocationID) {
		return
	}
	o, err := h.warehouse.CreateOpeningStock(r.Context(), warehouseScope(r), currentUser(r.Context()).Phone, body.LocationID, body.input())
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, toOpeningStockJSON(o))
}

// getOpeningStock is an opening stock of the member's locations, with its lines.
func (h *Handler) getOpeningStock(w http.ResponseWriter, r *http.Request) {
	o, err := h.warehouse.GetOpeningStock(r.Context(), warehouseScope(r), pathID(r, "id"))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toOpeningStockJSON(o))
}

// updateOpeningStock saves an opening stock of the member's locations with
// other fields and lines; its number and location stay.
func (h *Handler) updateOpeningStock(w http.ResponseWriter, r *http.Request) {
	var body openingStockInputJSON
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	o, err := h.warehouse.UpdateOpeningStock(r.Context(), warehouseScope(r), currentUser(r.Context()).Phone, pathID(r, "id"), body.input())
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toOpeningStockJSON(o))
}

// deleteOpeningStock hides an opening stock of the member's locations and
// takes its lines out of the stock.
func (h *Handler) deleteOpeningStock(w http.ResponseWriter, r *http.Request) {
	if err := h.warehouse.DeleteOpeningStock(r.Context(), warehouseScope(r), pathID(r, "id")); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// getStock is the products in stock in the location ?location_id= names
// (none: 400; one the member may not work in: 403) at the moment ?at=
// (now unless given), the moves of the document ?exclude_id= left out, by
// name: what an inventory starts from, or shows while it is edited.
func (h *Handler) getStock(w http.ResponseWriter, r *http.Request) {
	locationID, ok := locationParam(w, r)
	if !ok {
		return
	}
	if locationID == 0 {
		httpx.Error(w, http.StatusBadRequest, "validation_error", "Lokatsiyani tanlang")
		return
	}
	var at *time.Time
	if raw := r.URL.Query().Get("at"); raw != "" {
		moment, err := ledger.At(raw)
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		at = &moment
	}
	var excludeID int64
	if raw := r.URL.Query().Get("exclude_id"); raw != "" {
		id, err := strconv.ParseInt(raw, 10, 64)
		if err != nil || id <= 0 {
			httpx.Error(w, http.StatusBadRequest, "validation_error", "Hujjat noto'g'ri")
			return
		}
		excludeID = id
	}
	rows, err := h.warehouse.StockAt(r.Context(), warehouseScope(r), locationID, at, excludeID)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	out := make([]stockRowJSON, 0, len(rows))
	for _, row := range rows {
		out = append(out, stockRowJSON{ProductID: row.ProductID, Name: row.Name, Unit: row.Unit, Quantity: row.Quantity})
	}
	httpx.JSON(w, http.StatusOK, out)
}

// listProductMoves is a page of a product's moves in the member's
// locations, or in the one ?location_id= names, the newest document first.
func (h *Handler) listProductMoves(w http.ResponseWriter, r *http.Request) {
	in, ok := documentListParams(w, r)
	if !ok {
		return
	}
	result, err := h.warehouse.ProductMoves(r.Context(), warehouseScope(r), pathID(r, "id"), in.LocationID, in.Page)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	items := make([]productMoveJSON, 0, len(result.Items))
	for _, m := range result.Items {
		items = append(items, productMoveJSON{
			ID: m.ID, TransactionID: m.TransactionID, Kind: m.Kind, Number: m.Number, At: m.At, LocationID: m.LocationID, LocationName: m.LocationName, Quantity: m.Quantity, Counterpart: m.Counterpart,
			OrderID: m.OrderID, OrderTitle: m.OrderTitle,
		})
	}
	httpx.JSON(w, http.StatusOK, pageJSON[productMoveJSON]{Items: items, Total: result.Total, Page: result.Page, PageSize: result.PageSize})
}

// listOpenings is a page of a supplier's opening balances, the newest first.
func (h *Handler) listOpenings(w http.ResponseWriter, r *http.Request) {
	page, ok := pageParam(w, r)
	if !ok {
		return
	}
	result, err := h.warehouse.ListOpenings(r.Context(), sessionCompany(r), pathID(r, "id"), page)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	items := make([]openingJSON, 0, len(result.Items))
	for _, o := range result.Items {
		items = append(items, toOpeningJSON(o))
	}
	httpx.JSON(w, http.StatusOK, pageJSON[openingJSON]{Items: items, Total: result.Total, Page: result.Page, PageSize: result.PageSize})
}

// addOpening enters an opening balance of a supplier of the company the
// session works in, as the member the session is of.
func (h *Handler) addOpening(w http.ResponseWriter, r *http.Request) {
	var body openingInputJSON
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	o, err := h.warehouse.AddOpening(r.Context(), sessionCompany(r), currentUser(r.Context()).Phone, pathID(r, "id"), body.input())
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, toOpeningJSON(o))
}

// updateOpening saves an opening balance with other fields; its kind stays.
func (h *Handler) updateOpening(w http.ResponseWriter, r *http.Request) {
	var body openingInputJSON
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	o, err := h.warehouse.UpdateOpening(r.Context(), sessionCompany(r), currentUser(r.Context()).Phone, pathID(r, "id"), pathID(r, "openingId"), body.input())
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toOpeningJSON(o))
}

// deleteOpening hides an opening balance.
func (h *Handler) deleteOpening(w http.ResponseWriter, r *http.Request) {
	if err := h.warehouse.DeleteOpening(r.Context(), sessionCompany(r), pathID(r, "id"), pathID(r, "openingId")); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
