package task

import (
	"context"
	"errors"
	"slices"

	"github.com/jackc/pgx/v5"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/fields"
)

var (
	errStageNameTaken = apperr.New(apperr.Conflict, "name_taken", "Bu nomli bosqich allaqachon bor")
	errStageNotFound  = apperr.New(apperr.NotFound, "not_found", "Bosqich topilmadi")
	errNoColor        = invalid("Rangni tanlang")
)

// Colors are the colors a stage may be shown in: hues the app has class
// names for.
var Colors = []string{"slate", "red", "orange", "amber", "green", "teal", "blue", "violet", "pink"}

// Stage is a column of the board: the state a task is in. A stage that is
// done holds finished tasks, which are never overdue.
type Stage struct {
	ID    int64
	Name  string
	Color string
	Done  bool
}

// StageInput is a new stage.
type StageInput struct {
	Name  string
	Color string
	Done  bool
}

// StagePatch is what to change in a stage; nil leaves a part as it is.
type StagePatch struct {
	Name  *string
	Color *string
	Done  *bool
}

func toStage(st gen.TaskStage) Stage {
	return Stage{ID: st.ID, Name: st.Name, Color: st.Color, Done: st.IsDone}
}

// CreateStage adds a stage at the end of the company's stages.
func (s *Service) CreateStage(ctx context.Context, companyID int64, in StageInput) (Stage, error) {
	name, err := fields.CleanName(in.Name)
	if err != nil {
		return Stage{}, err
	}
	if !slices.Contains(Colors, in.Color) {
		return Stage{}, errNoColor
	}
	var st gen.TaskStage
	err = s.write(ctx, companyID, func(q *gen.Queries) error {
		st, err = q.CreateTaskStage(ctx, gen.CreateTaskStageParams{CompanyID: companyID, Name: name, Color: in.Color, IsDone: in.Done})
		if fields.Taken(err) {
			return errStageNameTaken
		}
		return err
	})
	if err != nil {
		return Stage{}, err
	}
	return toStage(st), nil
}

// Stages lists the company's stages in their order.
func (s *Service) Stages(ctx context.Context, companyID int64) ([]Stage, error) {
	rows, err := s.q.ListTaskStages(ctx, companyID)
	if err != nil {
		return nil, err
	}
	list := make([]Stage, 0, len(rows))
	for _, st := range rows {
		list = append(list, toStage(st))
	}
	return list, nil
}

// UpdateStage changes the name, the color and the done mark of the
// company's stage.
func (s *Service) UpdateStage(ctx context.Context, companyID, id int64, patch StagePatch) (Stage, error) {
	if patch.Name != nil {
		name, err := fields.CleanName(*patch.Name)
		if err != nil {
			return Stage{}, err
		}
		patch.Name = &name
	}
	if patch.Color != nil && !slices.Contains(Colors, *patch.Color) {
		return Stage{}, errNoColor
	}
	var st gen.TaskStage
	err := s.write(ctx, companyID, func(q *gen.Queries) error {
		var err error
		st, err = q.UpdateTaskStage(ctx, gen.UpdateTaskStageParams{
			ID: id, CompanyID: companyID, Name: patch.Name, Color: patch.Color, IsDone: patch.Done,
		})
		switch {
		case errors.Is(err, pgx.ErrNoRows):
			return errStageNotFound
		case fields.Taken(err):
			return errStageNameTaken
		}
		return err
	})
	if err != nil {
		return Stage{}, err
	}
	return toStage(st), nil
}

// DeleteStage hides the company's stage; its name is free again.
func (s *Service) DeleteStage(ctx context.Context, companyID, id int64) error {
	return s.write(ctx, companyID, func(q *gen.Queries) error {
		_, err := q.DeleteTaskStage(ctx, gen.DeleteTaskStageParams{ID: id, CompanyID: companyID})
		if errors.Is(err, pgx.ErrNoRows) {
			return errStageNotFound
		}
		return err
	})
}

// OrderStages puts the company's stages in the order of ids, which has to
// name each of them once and nothing else.
func (s *Service) OrderStages(ctx context.Context, companyID int64, ids []int64) error {
	return s.write(ctx, companyID, func(q *gen.Queries) error {
		rows, err := q.ListTaskStages(ctx, companyID)
		if err != nil {
			return err
		}
		live := make([]int64, 0, len(rows))
		for _, st := range rows {
			live = append(live, st.ID)
		}
		if !fields.SameIDs(ids, live) {
			return fields.ErrOrderChanged
		}
		return q.OrderTaskStages(ctx, gen.OrderTaskStagesParams{CompanyID: companyID, Ids: ids})
	})
}
