package company

import (
	"context"
	"strings"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

// PageSize is how many companies a list page holds.
const PageSize = 20

// ListInput filters the company list: Search matches the name, Status is
// "", "active" or "expired", Page starts at 1.
type ListInput struct {
	Search string
	Status string
	Page   int
}

// Page is one page of companies and the count of all that match.
type Page struct {
	Items    []Company
	Total    int64
	Page     int
	PageSize int
}

// likeEscaper makes a search term match literally inside ILIKE, whose escape
// character is the backslash.
var likeEscaper = strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)

// List returns a page of companies, newest first.
func (s *Service) List(ctx context.Context, in ListInput) (Page, error) {
	var search, status *string
	if term := strings.TrimSpace(in.Search); term != "" {
		escaped := likeEscaper.Replace(term)
		search = &escaped
	}
	if in.Status != "" {
		status = &in.Status
	}

	total, err := s.q.CountCompanies(ctx, gen.CountCompaniesParams{Search: search, Status: status})
	if err != nil {
		return Page{}, err
	}
	rows, err := s.q.ListCompanies(ctx, gen.ListCompaniesParams{
		Search: search,
		Status: status,
		Limit:  PageSize,
		Offset: int32((in.Page - 1) * PageSize),
	})
	if err != nil {
		return Page{}, err
	}
	today, err := s.q.CurrentDate(ctx)
	if err != nil {
		return Page{}, err
	}
	items := make([]Company, 0, len(rows))
	for _, c := range rows {
		items = append(items, withDaysLeft(c, today))
	}
	return Page{Items: items, Total: total, Page: in.Page, PageSize: PageSize}, nil
}
