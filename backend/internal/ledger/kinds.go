// Package ledger is the core of the journal (logic/warehouse.md, section
// 1): the kinds of document, their numbers, their moment, their currency
// and rate row, the stock moves they make, and the payments entered with
// them. The services of the warehouse, the sales and the finance build
// their documents on it.
package ledger

// Kind is a kind of document, as the journal keeps it.
type Kind string

const (
	Purchase        Kind = "purchase"
	Sale            Kind = "sale"
	Transfer        Kind = "transfer"
	Inventory       Kind = "inventory"
	OpeningStock    Kind = "opening_stock"
	SupplierPayment Kind = "supplier_payment"
	SupplierDebt    Kind = "supplier_debt"
	SupplierPrepay  Kind = "supplier_prepay"
	CustomerPayment Kind = "customer_payment"
	CustomerDebt    Kind = "customer_debt"
	CustomerPrepay  Kind = "customer_prepay"
	CashOpening     Kind = "cash_opening"
	Expense         Kind = "expense"
	Income          Kind = "income"
	MoneyTransfer   Kind = "money_transfer"
	Conversion      Kind = "conversion"
)

// titles is what each kind is called on screen.
var titles = map[Kind]string{
	Purchase:        "Xarid",
	Sale:            "Sotuv",
	Transfer:        "Ko'chirish",
	Inventory:       "Inventarizatsiya",
	OpeningStock:    "Boshlang'ich qoldiq",
	SupplierPayment: "To'lov",
	SupplierDebt:    "Boshlang'ich qarz",
	SupplierPrepay:  "Boshlang'ich avans",
	CustomerPayment: "Mijoz to'lovi",
	CustomerDebt:    "Mijoz boshlang'ich qarzi",
	CustomerPrepay:  "Mijoz boshlang'ich avansi",
	CashOpening:     "Kassa boshlang'ich qoldig'i",
	Expense:         "Xarajat",
	Income:          "Kirim",
	MoneyTransfer:   "O'tkazma",
	Conversion:      "Konvertatsiya",
}

// Title is what the kind is called; "Hujjat" for one the journal does not
// know.
func Title(k Kind) string {
	if title, ok := titles[k]; ok {
		return title
	}
	return "Hujjat"
}

// Numbered tells whether a document of the kind is headed with its number
// («Xarid № 12»): the goods documents and the finance documents are, the
// payments and the opening balances are not (logic/warehouse.md, 1.1).
func Numbered(k Kind) bool {
	switch k {
	case Purchase, Sale, Transfer, Inventory, OpeningStock, Expense, Income, MoneyTransfer, Conversion:
		return true
	}
	return false
}
