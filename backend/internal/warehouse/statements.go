package warehouse

import (
	"context"
	"time"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

// StatementRow is one document of a supplier's statement
// (logic/warehouse.md, section 6): the document, its amount in its
// currency and in so'm, how it changed what is owed and what was owed
// after it; a payment entered with a purchase names the purchase.
type StatementRow struct {
	ID            int64
	Kind          string
	Number        int32
	At            time.Time
	Amount        string
	CurrencyID    int64
	AmountUZS     string
	DeltaUZS      string
	BalanceUZS    string
	LinkedID      *int64
	LinkedNumber  *int32
	Note          *string
	CreatedByName *string
}

// StatementPage is one page of a statement, the newest document first.
type StatementPage struct {
	Items    []StatementRow
	Total    int64
	Page     int
	PageSize int
}

// Statement is a page of the supplier's statement. The supplier comes
// first: one that is not there is not found.
func (s *Service) Statement(ctx context.Context, companyID, supplierID int64, page int) (StatementPage, error) {
	if err := pageOf(page); err != nil {
		return StatementPage{}, err
	}
	if _, err := getSupplier(ctx, s.q, companyID, supplierID); err != nil {
		return StatementPage{}, err
	}
	total, err := s.q.CountSupplierStatement(ctx, gen.CountSupplierStatementParams{SupplierID: supplierID, CompanyID: companyID})
	if err != nil {
		return StatementPage{}, err
	}
	rows, err := s.q.ListSupplierStatement(ctx, gen.ListSupplierStatementParams{SupplierID: supplierID, CompanyID: companyID, Limit: PageSize, Offset: int32((page - 1) * PageSize)})
	if err != nil {
		return StatementPage{}, err
	}
	items := make([]StatementRow, 0, len(rows))
	for _, r := range rows {
		items = append(items, StatementRow{
			ID: r.ID, Kind: r.Kind, Number: r.Number, At: r.DocAt.UTC(), Amount: amount(r.Amount), CurrencyID: r.CurrencyID,
			AmountUZS: amount(r.AmountUzs), DeltaUZS: amount(r.DeltaUzs), BalanceUZS: amount(r.BalanceUzs),
			LinkedID: r.LinkedID, LinkedNumber: r.LinkedNumber, Note: r.Note, CreatedByName: r.CreatedByName,
		})
	}
	return StatementPage{Items: items, Total: total, Page: page, PageSize: PageSize}, nil
}
