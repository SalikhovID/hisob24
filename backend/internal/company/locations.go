package company

import (
	"context"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
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
