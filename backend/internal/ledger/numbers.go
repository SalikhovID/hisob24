package ledger

import (
	"context"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

// NextNumber is the number the company's next document of the kind takes:
// one past the highest so far, the deleted counted (logic/warehouse.md,
// 1.1). Run under the company's lock, so two documents entered at once take
// two numbers.
func NextNumber(ctx context.Context, q *gen.Queries, companyID int64, kind Kind) (int32, error) {
	return q.NextNumber(ctx, gen.NextNumberParams{CompanyID: companyID, Kind: string(kind)})
}
