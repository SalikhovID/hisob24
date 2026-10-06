package app

import (
	"net/http"

	"github.com/SalikhovID/hisob24/backend/internal/httpx"
	"github.com/SalikhovID/hisob24/backend/internal/task"
)

type stageJSON struct {
	ID     int64  `json:"id"`
	Name   string `json:"name"`
	Color  string `json:"color"`
	IsDone bool   `json:"is_done"`
}

func toStageJSON(st task.Stage) stageJSON {
	return stageJSON{ID: st.ID, Name: st.Name, Color: st.Color, IsDone: st.Done}
}

// listTaskStages is the stages of the company the session works in, in
// their order: the columns of the board, and what a task's form offers.
func (h *Handler) listTaskStages(w http.ResponseWriter, r *http.Request) {
	stages, err := h.tasks.Stages(r.Context(), sessionCompany(r))
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

// createTaskStage adds a stage at the end of the owner's company's stages.
func (h *Handler) createTaskStage(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name   string `json:"name"`
		Color  string `json:"color"`
		IsDone bool   `json:"is_done"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	st, err := h.tasks.CreateStage(r.Context(), sessionCompany(r), task.StageInput{Name: body.Name, Color: body.Color, Done: body.IsDone})
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, toStageJSON(st))
}

// updateTaskStage changes the name, the color or the done mark of a stage
// of the owner's company; what the body leaves out stays.
func (h *Handler) updateTaskStage(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name   *string `json:"name"`
		Color  *string `json:"color"`
		IsDone *bool   `json:"is_done"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	st, err := h.tasks.UpdateStage(r.Context(), sessionCompany(r), pathID(r, "id"),
		task.StagePatch{Name: body.Name, Color: body.Color, Done: body.IsDone})
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toStageJSON(st))
}

// deleteTaskStage hides a stage of the owner's company.
func (h *Handler) deleteTaskStage(w http.ResponseWriter, r *http.Request) {
	if err := h.tasks.DeleteStage(r.Context(), sessionCompany(r), pathID(r, "id")); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// orderTaskStages puts the stages of the owner's company in a new order.
func (h *Handler) orderTaskStages(w http.ResponseWriter, r *http.Request) {
	var body orderBody
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	if err := h.tasks.OrderStages(r.Context(), sessionCompany(r), body.IDs); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type taskFieldJSON struct {
	ID         int64  `json:"id"`
	Label      string `json:"label"`
	Kind       string `json:"kind"`
	Required   bool   `json:"required"`
	DropdownID *int64 `json:"dropdown_id"`
}

type taskTypeJSON struct {
	ID     int64           `json:"id"`
	Name   string          `json:"name"`
	Fields []taskFieldJSON `json:"fields"`
}

func toTaskFieldJSON(f task.Field) taskFieldJSON {
	return taskFieldJSON{ID: f.ID, Label: f.Label, Kind: f.Kind, Required: f.Required, DropdownID: f.DropdownID}
}

func toTaskTypeJSON(t task.Type) taskTypeJSON {
	fields := make([]taskFieldJSON, 0, len(t.Fields))
	for _, f := range t.Fields {
		fields = append(fields, toTaskFieldJSON(f))
	}
	return taskTypeJSON{ID: t.ID, Name: t.Name, Fields: fields}
}

// listTaskTypes is the task types of the company the session works in, each
// with its fields: what a task's form asks beside the title, the deadline,
// the customer and the assignee.
func (h *Handler) listTaskTypes(w http.ResponseWriter, r *http.Request) {
	types, err := h.tasks.Types(r.Context(), sessionCompany(r))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	body := make([]taskTypeJSON, 0, len(types))
	for _, t := range types {
		body = append(body, toTaskTypeJSON(t))
	}
	httpx.JSON(w, http.StatusOK, body)
}

// createTaskType adds a type with no fields to the owner's company.
func (h *Handler) createTaskType(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name string `json:"name"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	t, err := h.tasks.CreateType(r.Context(), sessionCompany(r), body.Name)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, toTaskTypeJSON(t))
}

// orderTaskTypes puts the task types of the owner's company in a new order.
func (h *Handler) orderTaskTypes(w http.ResponseWriter, r *http.Request) {
	var body orderBody
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	if err := h.tasks.OrderTypes(r.Context(), sessionCompany(r), body.IDs); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// renameTaskType gives a task type of the owner's company another name.
func (h *Handler) renameTaskType(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name string `json:"name"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	t, err := h.tasks.RenameType(r.Context(), sessionCompany(r), pathID(r, "id"), body.Name)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toTaskTypeJSON(t))
}

// deleteTaskType hides a task type of the owner's company, and its fields
// with it.
func (h *Handler) deleteTaskType(w http.ResponseWriter, r *http.Request) {
	if err := h.tasks.DeleteType(r.Context(), sessionCompany(r), pathID(r, "id")); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// addTaskField adds a field at the end of a task type of the owner's
// company.
func (h *Handler) addTaskField(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Label      string `json:"label"`
		Kind       string `json:"kind"`
		Required   bool   `json:"required"`
		DropdownID *int64 `json:"dropdown_id"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	f, err := h.tasks.AddField(r.Context(), sessionCompany(r), pathID(r, "id"), task.FieldInput{
		Label: body.Label, Kind: body.Kind, Required: body.Required, DropdownID: body.DropdownID,
	})
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, toTaskFieldJSON(f))
}

// updateTaskField changes the name and the mark of a field of a task type
// of the owner's company; what the body leaves out stays.
func (h *Handler) updateTaskField(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Label    *string `json:"label"`
		Required *bool   `json:"required"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	f, err := h.tasks.UpdateField(r.Context(), sessionCompany(r), pathID(r, "id"), pathID(r, "fieldId"),
		task.FieldPatch{Label: body.Label, Required: body.Required})
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toTaskFieldJSON(f))
}

// deleteTaskField hides a field of a task type of the owner's company.
func (h *Handler) deleteTaskField(w http.ResponseWriter, r *http.Request) {
	err := h.tasks.DeleteField(r.Context(), sessionCompany(r), pathID(r, "id"), pathID(r, "fieldId"))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// orderTaskFields puts the fields of a task type of the owner's company in
// a new order.
func (h *Handler) orderTaskFields(w http.ResponseWriter, r *http.Request) {
	var body orderBody
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	if err := h.tasks.OrderFields(r.Context(), sessionCompany(r), pathID(r, "id"), body.IDs); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
