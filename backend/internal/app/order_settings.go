package app

import (
	"net/http"

	"github.com/SalikhovID/hisob24/backend/internal/httpx"
	"github.com/SalikhovID/hisob24/backend/internal/order"
)

type stageJSON struct {
	ID     int64  `json:"id"`
	Name   string `json:"name"`
	Color  string `json:"color"`
	IsDone bool   `json:"is_done"`
}

func toStageJSON(st order.Stage) stageJSON {
	return stageJSON{ID: st.ID, Name: st.Name, Color: st.Color, IsDone: st.Done}
}

// listOrderStages is the stages of the company the session works in, in
// their order: the columns of the board, and what an order's form offers.
func (h *Handler) listOrderStages(w http.ResponseWriter, r *http.Request) {
	stages, err := h.orders.Stages(r.Context(), sessionCompany(r))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	body := make([]stageJSON, 0, len(stages))
	for _, st := range stages {
		body = append(body, toStageJSON(st))
	}
	httpx.JSON(w, http.StatusOK, body)
}

// createOrderStage adds a stage at the end of the owner's company's stages.
func (h *Handler) createOrderStage(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name   string `json:"name"`
		Color  string `json:"color"`
		IsDone bool   `json:"is_done"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	st, err := h.orders.CreateStage(r.Context(), sessionCompany(r), order.StageInput{Name: body.Name, Color: body.Color, Done: body.IsDone})
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, toStageJSON(st))
}

// updateOrderStage changes the name, the color or the done mark of a stage
// of the owner's company; what the body leaves out stays.
func (h *Handler) updateOrderStage(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name   *string `json:"name"`
		Color  *string `json:"color"`
		IsDone *bool   `json:"is_done"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	st, err := h.orders.UpdateStage(r.Context(), sessionCompany(r), pathID(r, "id"),
		order.StagePatch{Name: body.Name, Color: body.Color, Done: body.IsDone})
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toStageJSON(st))
}

// deleteOrderStage hides a stage of the owner's company.
func (h *Handler) deleteOrderStage(w http.ResponseWriter, r *http.Request) {
	if err := h.orders.DeleteStage(r.Context(), sessionCompany(r), pathID(r, "id")); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// reorderOrderStages puts the stages of the owner's company in a new order.
func (h *Handler) reorderOrderStages(w http.ResponseWriter, r *http.Request) {
	var body reorderBody
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	if err := h.orders.ReorderStages(r.Context(), sessionCompany(r), body.IDs); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type orderFieldJSON struct {
	ID         int64  `json:"id"`
	Label      string `json:"label"`
	Kind       string `json:"kind"`
	Required   bool   `json:"required"`
	DropdownID *int64 `json:"dropdown_id"`
}

type orderTypeJSON struct {
	ID     int64            `json:"id"`
	Name   string           `json:"name"`
	Fields []orderFieldJSON `json:"fields"`
}

func toOrderFieldJSON(f order.Field) orderFieldJSON {
	return orderFieldJSON{ID: f.ID, Label: f.Label, Kind: f.Kind, Required: f.Required, DropdownID: f.DropdownID}
}

func toOrderTypeJSON(t order.Type) orderTypeJSON {
	fields := make([]orderFieldJSON, 0, len(t.Fields))
	for _, f := range t.Fields {
		fields = append(fields, toOrderFieldJSON(f))
	}
	return orderTypeJSON{ID: t.ID, Name: t.Name, Fields: fields}
}

// listOrderTypes is the order types of the company the session works in, each
// with its fields: what an order's form asks beside the title, the deadline,
// the customer and the assignee.
func (h *Handler) listOrderTypes(w http.ResponseWriter, r *http.Request) {
	types, err := h.orders.Types(r.Context(), sessionCompany(r))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	body := make([]orderTypeJSON, 0, len(types))
	for _, t := range types {
		body = append(body, toOrderTypeJSON(t))
	}
	httpx.JSON(w, http.StatusOK, body)
}

// createOrderType adds a type with no fields to the owner's company.
func (h *Handler) createOrderType(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name string `json:"name"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	t, err := h.orders.CreateType(r.Context(), sessionCompany(r), body.Name)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, toOrderTypeJSON(t))
}

// reorderOrderTypes puts the order types of the owner's company in a new order.
func (h *Handler) reorderOrderTypes(w http.ResponseWriter, r *http.Request) {
	var body reorderBody
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	if err := h.orders.ReorderTypes(r.Context(), sessionCompany(r), body.IDs); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// renameOrderType gives an order type of the owner's company another name.
func (h *Handler) renameOrderType(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name string `json:"name"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	t, err := h.orders.RenameType(r.Context(), sessionCompany(r), pathID(r, "id"), body.Name)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toOrderTypeJSON(t))
}

// deleteOrderType hides an order type of the owner's company, and its fields
// with it.
func (h *Handler) deleteOrderType(w http.ResponseWriter, r *http.Request) {
	if err := h.orders.DeleteType(r.Context(), sessionCompany(r), pathID(r, "id")); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// addOrderField adds a field at the end of an order type of the owner's
// company.
func (h *Handler) addOrderField(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Label      string `json:"label"`
		Kind       string `json:"kind"`
		Required   bool   `json:"required"`
		DropdownID *int64 `json:"dropdown_id"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	f, err := h.orders.AddField(r.Context(), sessionCompany(r), pathID(r, "id"), order.FieldInput{
		Label: body.Label, Kind: body.Kind, Required: body.Required, DropdownID: body.DropdownID,
	})
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, toOrderFieldJSON(f))
}

// updateOrderField changes the name and the mark of a field of an order type
// of the owner's company; what the body leaves out stays.
func (h *Handler) updateOrderField(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Label    *string `json:"label"`
		Required *bool   `json:"required"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	f, err := h.orders.UpdateField(r.Context(), sessionCompany(r), pathID(r, "id"), pathID(r, "fieldId"),
		order.FieldPatch{Label: body.Label, Required: body.Required})
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toOrderFieldJSON(f))
}

// deleteOrderField hides a field of an order type of the owner's company.
func (h *Handler) deleteOrderField(w http.ResponseWriter, r *http.Request) {
	err := h.orders.DeleteField(r.Context(), sessionCompany(r), pathID(r, "id"), pathID(r, "fieldId"))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// reorderOrderFields puts the fields of an order type of the owner's company in
// a new order.
func (h *Handler) reorderOrderFields(w http.ResponseWriter, r *http.Request) {
	var body reorderBody
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	if err := h.orders.ReorderFields(r.Context(), sessionCompany(r), pathID(r, "id"), body.IDs); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
