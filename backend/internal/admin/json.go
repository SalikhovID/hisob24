package admin

import (
	"time"

	"github.com/SalikhovID/hisob24/backend/internal/company"
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

type memberJSON struct {
	Phone     string    `json:"phone"`
	FullName  *string   `json:"full_name"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
}

func toMemberJSON(m company.Member) memberJSON {
	return memberJSON{Phone: m.Phone, FullName: m.FullName, Role: m.Role, CreatedAt: m.CreatedAt}
}

type detailJSON struct {
	companyJSON
	Users []memberJSON `json:"users"`
}
