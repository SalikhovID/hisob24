package admin

import (
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/SalikhovID/hisob24/backend/internal/company"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

type companyJSON struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	EndDate   string    `json:"end_date"`
	IsActive  bool      `json:"is_active"`
	DaysLeft  int       `json:"days_left"`
	CreatedAt time.Time `json:"created_at"`
}

func toCompanyJSON(c company.Company) companyJSON {
	return companyJSON{
		ID:        c.ID,
		Name:      c.Name,
		EndDate:   c.EndDate.Format(time.DateOnly),
		IsActive:  c.IsActive,
		DaysLeft:  c.DaysLeft,
		CreatedAt: c.CreatedAt,
	}
}

type pageJSON struct {
	Items    []companyJSON `json:"items"`
	Total    int64         `json:"total"`
	Page     int           `json:"page"`
	PageSize int           `json:"page_size"`
}

// locationJSON is a location of the company, as the user app names it.
type locationJSON struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

type memberJSON struct {
	Phone    string  `json:"phone"`
	FullName *string `json:"full_name"`
	Role     string  `json:"role"`
	// RoleID and RoleName are the company role the member holds (the user
	// app's), null for the owner and for a user without one.
	RoleID   *int64  `json:"role_id"`
	RoleName *string `json:"role_name"`
	// Locations is the locations the member may work in (the user app's):
	// null for every one, the restriction's live ones otherwise.
	Locations *[]locationJSON `json:"locations"`
	CreatedAt time.Time       `json:"created_at"`
}

func toMemberJSON(m company.Member) memberJSON {
	body := memberJSON{Phone: m.Phone, FullName: m.FullName, Role: m.Role, RoleID: m.RoleID, RoleName: m.RoleName, CreatedAt: m.CreatedAt}
	if !m.AllLocations {
		locations := make([]locationJSON, 0, len(m.Locations))
		for _, l := range m.Locations {
			locations = append(locations, locationJSON{ID: l.ID, Name: l.Name})
		}
		body.Locations = &locations
	}
	return body
}

type detailJSON struct {
	companyJSON
	Users []memberJSON `json:"users"`
}

type billingJSON struct {
	ID          int64     `json:"id"`
	CompanyID   int64     `json:"company_id"`
	Days        int32     `json:"days"`
	Amount      *string   `json:"amount"`
	PrevEndDate string    `json:"prev_end_date"`
	NewEndDate  string    `json:"new_end_date"`
	Note        *string   `json:"note"`
	CreatedBy   *int64    `json:"created_by"`
	CreatedAt   time.Time `json:"created_at"`
}

func toBillingJSON(b gen.Billing) billingJSON {
	return billingJSON{
		ID:          b.ID,
		CompanyID:   b.CompanyID,
		Days:        b.Days,
		Amount:      amountText(b.Amount),
		PrevEndDate: b.PrevEndDate.Format(time.DateOnly),
		NewEndDate:  b.NewEndDate.Format(time.DateOnly),
		Note:        b.Note,
		CreatedBy:   b.CreatedBy,
		CreatedAt:   b.CreatedAt,
	}
}

// amountText is the stored amount as the database writes it, "150000.50",
// or nil when there is none.
func amountText(n pgtype.Numeric) *string {
	if !n.Valid {
		return nil
	}
	v, err := n.Value()
	if err != nil {
		return nil
	}
	s, ok := v.(string)
	if !ok {
		return nil
	}
	return &s
}

type adminAccountJSON struct {
	TelegramID int64     `json:"telegram_id"`
	FullName   *string   `json:"full_name"`
	IsActive   bool      `json:"is_active"`
	CreatedAt  time.Time `json:"created_at"`
}

func toAdminAccountJSON(a gen.Admin) adminAccountJSON {
	return adminAccountJSON{TelegramID: a.TelegramID, FullName: a.FullName, IsActive: a.IsActive, CreatedAt: a.CreatedAt}
}
