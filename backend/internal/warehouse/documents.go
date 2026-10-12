package warehouse

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/catalog"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/ledger"
)

// The goods documents besides the purchases (logic/warehouse.md, 5.1–5.3):
// what a transfer, an inventory and an opening stock have in common.

var (
	errTransferNotFound     = apperr.New(apperr.NotFound, "not_found", "Ko'chirish topilmadi")
	errInventoryNotFound    = apperr.New(apperr.NotFound, "not_found", "Inventarizatsiya topilmadi")
	errOpeningStockNotFound = apperr.New(apperr.NotFound, "not_found", "Hujjat topilmadi")
)

// DocumentListInput narrows a list of goods documents: LocationID keeps one
// of the scope's locations (0: all of them). Page starts at 1.
type DocumentListInput struct {
	LocationID int64
	Page       int
}

// locationsOf is the locations a list is of: the scope's, or the one asked
// for (one outside the scope counts as none: the handler refuses it before).
func locationsOf(scope Scope, locationID int64) []int64 {
	if locationID == 0 {
		return scope.LocationIDs
	}
	if scope.has(locationID) {
		return []int64{locationID}
	}
	return []int64{}
}

// lineRule says what a kind's lines need: a quantity of nothing allowed (an
// inventory counts none), a price, and whether a service may be a line (a
// sale) or what it is refused with.
type lineRule struct {
	AllowZero      bool
	WithPrice      bool
	AllowService   bool
	ServiceRefused string
}

// countedPattern is a quantity as the client writes it, 0 allowed.
var countedPattern = regexp.MustCompile(`^\d{1,9}(\.\d{1,3})?$`)

// checkLines reads the lines of a goods document against the company,
// inside the write: at least one; each product one of the company's, a
// product not a service, active unless the document already holds it
// (held), once; its quantity (above zero, or not below it where the rule
// allows); its price where the rule has one.
func checkLines(ctx context.Context, q *gen.Queries, companyID int64, lines []ItemInput, held map[int64]bool, rule lineRule) ([]checkedItem, error) {
	if len(lines) == 0 {
		return nil, invalid("Kamida bitta mahsulot qo'shing")
	}
	items := make([]checkedItem, 0, len(lines))
	seen := make(map[int64]bool, len(lines))
	for _, it := range lines {
		if it.ProductID == 0 {
			return nil, invalid("Mahsulotni tanlang")
		}
		p, err := q.ProductStanding(ctx, gen.ProductStandingParams{ID: it.ProductID, CompanyID: companyID})
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, invalid("Mahsulotni tanlang")
		}
		if err != nil {
			return nil, err
		}
		if p.Kind != catalog.KindProduct && !rule.AllowService {
			return nil, invalid(rule.ServiceRefused)
		}
		if !p.IsActive && !held[it.ProductID] {
			return nil, invalid("Mahsulot nofaol")
		}
		if seen[it.ProductID] {
			return nil, invalid(fmt.Sprintf("«%s» ikki marta kiritilgan", p.Name))
		}
		seen[it.ProductID] = true
		badQuantity := fmt.Sprintf("«%s» miqdori noto'g'ri", p.Name)
		var quantity pgtype.Numeric
		if rule.AllowZero {
			if it.Quantity == nil || !countedPattern.MatchString(*it.Quantity) || quantity.Scan(*it.Quantity) != nil {
				return nil, invalid(badQuantity)
			}
		} else if quantity, err = catalog.Quantity(it.Quantity, badQuantity); err != nil {
			return nil, err
		}
		item := checkedItem{ProductID: it.ProductID, Kind: p.Kind, Quantity: quantity}
		if rule.WithPrice {
			badPrice := fmt.Sprintf("«%s» narxi noto'g'ri", p.Name)
			price, err := catalog.Money(it.Price, badPrice)
			if err != nil {
				return nil, err
			}
			if !price.Valid {
				return nil, invalid(badPrice)
			}
			item.Price = price
		}
		items = append(items, item)
	}
	return items, nil
}

// writeGoodsLines replaces the document's lines with the lines given.
func writeGoodsLines(ctx context.Context, q *gen.Queries, transactionID int64, items []checkedItem) error {
	if err := q.DeleteTransactionItems(ctx, transactionID); err != nil {
		return err
	}
	for i, it := range items {
		if err := q.AddTransactionItem(ctx, gen.AddTransactionItemParams{TransactionID: transactionID, ProductID: it.ProductID, Quantity: it.Quantity, Expected: it.Expected, Price: it.Price, Position: int32(i + 1)}); err != nil {
			return err
		}
	}
	return nil
}

// linesOf is the lines as the moves are made from them: a service moves
// nothing, so it is left out.
func linesOf(items []checkedItem) []ledger.Line {
	lines := make([]ledger.Line, 0, len(items))
	for _, it := range items {
		if it.Kind == catalog.KindService {
			continue
		}
		lines = append(lines, ledger.Line{ProductID: it.ProductID, Quantity: it.Quantity, Expected: it.Expected})
	}
	return lines
}

// productsOf is the products of the lines, for the stock check.
func productsOf(items []checkedItem) []int64 {
	ids := make([]int64, 0, len(items))
	for _, it := range items {
		ids = append(ids, it.ProductID)
	}
	return ids
}

// productsOfRows is the products of the lines kept, for the stock check
// after they are written anew or removed.
func productsOfRows(rows []gen.ListTransactionItemsRow) []int64 {
	ids := make([]int64, 0, len(rows))
	for _, r := range rows {
		ids = append(ids, r.ProductID)
	}
	return ids
}

// heldOf is the products the document holds now: kept even when inactive.
func heldOf(rows []gen.ListTransactionItemsRow) map[int64]bool {
	held := make(map[int64]bool, len(rows))
	for _, r := range rows {
		held[r.ProductID] = true
	}
	return held
}

// goodsHead is what the goods documents show alike.
type goodsHead struct {
	ID            int64
	Number        int32
	LocationID    int64
	LocationName  string
	At            time.Time
	Note          *string
	ItemsCount    int64
	CreatedByName *string
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

func toGoodsHead(r gen.GetGoodsDocumentRow) goodsHead {
	return goodsHead{
		ID: r.ID, Number: r.Number, LocationID: r.LocationID, LocationName: r.LocationName, At: r.DocAt.UTC(), Note: r.Note, ItemsCount: r.ItemsCount,
		CreatedByName: r.CreatedByName, CreatedAt: r.CreatedAt, UpdatedAt: r.UpdatedAt,
	}
}

// getGoodsDocument is the document of the kind in the scope's locations;
// one outside them is not found (notFound).
func getGoodsDocument(ctx context.Context, q *gen.Queries, scope Scope, kind ledger.Kind, id int64, notFound error) (gen.GetGoodsDocumentRow, error) {
	r, err := q.GetGoodsDocument(ctx, gen.GetGoodsDocumentParams{ID: id, CompanyID: scope.CompanyID, Kind: string(kind), LocationIds: scope.LocationIDs})
	if errors.Is(err, pgx.ErrNoRows) {
		return gen.GetGoodsDocumentRow{}, notFound
	}
	return r, err
}

// listGoodsDocuments is a page of the documents of the kind in the
// locations, the newest first, with how many there are on all pages.
func listGoodsDocuments(ctx context.Context, q *gen.Queries, companyID int64, kind ledger.Kind, locations []int64, page int) ([]gen.ListGoodsDocumentsRow, int64, error) {
	if err := pageOf(page); err != nil {
		return nil, 0, err
	}
	total, err := q.CountGoodsDocuments(ctx, gen.CountGoodsDocumentsParams{CompanyID: companyID, Kind: string(kind), LocationIds: locations})
	if err != nil {
		return nil, 0, err
	}
	rows, err := q.ListGoodsDocuments(ctx, gen.ListGoodsDocumentsParams{CompanyID: companyID, Kind: string(kind), LocationIds: locations, Limit: PageSize, Offset: int32((page - 1) * PageSize)})
	return rows, total, err
}
