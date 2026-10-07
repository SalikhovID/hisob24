package company

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/fields"
	"github.com/SalikhovID/hisob24/backend/internal/user"
)

var (
	errLocationNotFound  = apperr.New(apperr.NotFound, "not_found", "Lokatsiya topilmadi")
	errLocationNameTaken = apperr.New(apperr.Conflict, "name_taken", "Bu nomli lokatsiya allaqachon bor")
	errLastLocation      = apperr.New(apperr.Conflict, "last_location", "Kompaniyaning yagona lokatsiyasi o'chirilmaydi")
)

// MemberLocations is the locations the member with phone may work in
// (logic/locations.md, section 5): every live one of the company's for the
// owner and for a member without a restriction, the live ones of the
// restriction otherwise; in the order they were added. None for someone who
// is not a member.
func (s *Service) MemberLocations(ctx context.Context, companyID int64, phone string) ([]Location, error) {
	rows, err := s.q.ListMemberLocations(ctx, gen.ListMemberLocationsParams{UserPhone: phone, CompanyID: companyID})
	if err != nil {
		return nil, err
	}
	locations := make([]Location, 0, len(rows))
	for _, r := range rows {
		locations = append(locations, Location{ID: r.ID, Name: r.Name})
	}
	return locations, nil
}

// restrictions is the restrictions of the company's members: each
// restricted member's live locations, by phone.
func (s *Service) restrictions(ctx context.Context, companyID int64) (map[string][]Location, error) {
	rows, err := s.q.ListCompanyMemberLocations(ctx, companyID)
	if err != nil {
		return nil, err
	}
	of := map[string][]Location{}
	for _, r := range rows {
		of[r.UserPhone] = append(of[r.UserPhone], Location{ID: r.ID, Name: r.Name})
	}
	return of, nil
}

// restrictedTo is a member's Locations as the lists tell them: nil for a
// member who works in every location, the restriction's live locations
// otherwise, none of them an empty list rather than nil.
func restrictedTo(allLocations bool, locations []Location) []Location {
	if allLocations {
		return nil
	}
	if locations == nil {
		return []Location{}
	}
	return locations
}

// AdminLocation is a location as the admin panel lists it: with how many
// tasks stand in it and when it was added.
type AdminLocation struct {
	Location
	TasksCount int64
	CreatedAt  time.Time
}

// Locations lists the company's live locations for the admin, in the order
// they were added, each with how many tasks stand in it.
func (s *Service) Locations(ctx context.Context, companyID int64) ([]AdminLocation, error) {
	rows, err := s.q.ListLocations(ctx, companyID)
	if err != nil {
		return nil, err
	}
	locations := make([]AdminLocation, 0, len(rows))
	for _, r := range rows {
		locations = append(locations, AdminLocation{Location: Location{ID: r.ID, Name: r.Name}, TasksCount: r.TasksCount, CreatedAt: r.CreatedAt})
	}
	return locations, nil
}

// AddLocation adds a location to the company (logic/locations.md, section
// 3): the name trimmed, 1–60 characters, one location's in the company
// (whatever the case; a deleted location's name is free). The company is
// held, so two additions take turns.
func (s *Service) AddLocation(ctx context.Context, companyID int64, name string) (AdminLocation, error) {
	cleaned, err := fields.CleanName(name)
	if err != nil {
		return AdminLocation{}, err
	}
	var added AdminLocation
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		if _, err := q.LockCompany(ctx, companyID); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return errNotFound
			}
			return err
		}
		l, err := q.CreateLocation(ctx, gen.CreateLocationParams{CompanyID: companyID, Name: cleaned})
		if fields.Taken(err) {
			return errLocationNameTaken
		}
		if err != nil {
			return err
		}
		added = AdminLocation{Location: Location{ID: l.ID, Name: l.Name}, CreatedAt: l.CreatedAt}
		return nil
	})
	return added, err
}

// RenameLocation renames the company's location, under the same rules; a
// location that is not the company's, or is deleted, is not found.
func (s *Service) RenameLocation(ctx context.Context, companyID, id int64, name string) (AdminLocation, error) {
	cleaned, err := fields.CleanName(name)
	if err != nil {
		return AdminLocation{}, err
	}
	l, err := s.q.RenameLocation(ctx, gen.RenameLocationParams{ID: id, CompanyID: companyID, Name: cleaned})
	if errors.Is(err, pgx.ErrNoRows) {
		return AdminLocation{}, errLocationNotFound
	}
	if fields.Taken(err) {
		return AdminLocation{}, errLocationNameTaken
	}
	if err != nil {
		return AdminLocation{}, err
	}
	count, err := s.q.CountLocationTasks(ctx, l.ID)
	if err != nil {
		return AdminLocation{}, err
	}
	return AdminLocation{Location: Location{ID: l.ID, Name: l.Name}, TasksCount: count, CreatedAt: l.CreatedAt}, nil
}

// DeleteLocation hides the company's location: neither its last one nor one
// a task stands in (the deleted tasks do not count). It holds the company
// the way a write of its tasks does, so the count cannot change under it.
// A member's restriction keeps naming the location; its name is free again.
func (s *Service) DeleteLocation(ctx context.Context, companyID, id int64) error {
	return pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		if _, err := q.LockCompanyCustomers(ctx, companyID); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return errLocationNotFound
			}
			return err
		}
		if _, err := q.GetLocation(ctx, gen.GetLocationParams{ID: id, CompanyID: companyID}); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return errLocationNotFound
			}
			return err
		}
		left, err := q.CountLocations(ctx, companyID)
		if err != nil {
			return err
		}
		if left <= 1 {
			return errLastLocation
		}
		tasks, err := q.CountLocationTasks(ctx, id)
		if err != nil {
			return err
		}
		if tasks > 0 {
			return apperr.New(apperr.Conflict, "location_in_use", fmt.Sprintf("Bu lokatsiyada %d ta vazifa bor", tasks))
		}
		_, err = q.DeleteLocation(ctx, gen.DeleteLocationParams{ID: id, CompanyID: companyID})
		return err
	})
}

// SetEmployeeLocations restricts a user of the company to the locations
// (logic/locations.md, section 5), or lets them work in every one again
// (nil). The locations have to be the company's live ones, at least one, a
// repeated one counts once; the owner is never restricted. It takes effect
// from the member's next request on.
func (s *Service) SetEmployeeLocations(ctx context.Context, companyID int64, phone string, ids *[]int64) (Member, error) {
	normalized, err := user.NormalizePhone(phone)
	if err != nil {
		return Member{}, errEmployeeNotFound // no member has such a phone
	}
	var chosen []int64
	if ids != nil {
		if len(*ids) == 0 {
			return Member{}, invalid("Kamida bitta lokatsiyani tanlang")
		}
		seen := map[int64]bool{}
		for _, id := range *ids {
			if seen[id] {
				continue
			}
			seen[id] = true
			if _, err := s.q.GetLocation(ctx, gen.GetLocationParams{ID: id, CompanyID: companyID}); err != nil {
				if errors.Is(err, pgx.ErrNoRows) {
					return Member{}, errLocationNotFound
				}
				return Member{}, err
			}
			chosen = append(chosen, id)
		}
	}
	var m Member
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		_, err := q.SetMemberAllLocations(ctx, gen.SetMemberAllLocationsParams{UserPhone: normalized, CompanyID: companyID, AllLocations: ids == nil})
		if errors.Is(err, pgx.ErrNoRows) {
			return s.whyNotAnEmployee(ctx, companyID, normalized)
		}
		if err != nil {
			return err
		}
		// The restriction before gives way to this one, or to none.
		if err := q.DeleteMemberLocations(ctx, gen.DeleteMemberLocationsParams{UserPhone: normalized, CompanyID: companyID}); err != nil {
			return err
		}
		for _, id := range chosen {
			if err := q.AddMemberLocation(ctx, gen.AddMemberLocationParams{UserPhone: normalized, CompanyID: companyID, LocationID: id}); err != nil {
				return err
			}
		}
		m, err = memberIn(ctx, q, companyID, normalized)
		return err
	})
	return m, err
}
