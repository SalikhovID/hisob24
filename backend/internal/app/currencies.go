package app

import (
	"net/http"
	"time"

	"github.com/SalikhovID/hisob24/backend/internal/currency"
	"github.com/SalikhovID/hisob24/backend/internal/httpx"
)

// companyCurrencyJSON is a currency the company has turned on, with the
// rate in force now ("12800.0000"; "1.0000" for the so'm; null while none
// was set).
type companyCurrencyJSON struct {
	ID     int64   `json:"id"`
	Code   string  `json:"code"`
	Name   string  `json:"name"`
	Symbol string  `json:"symbol"`
	Rate   *string `json:"rate"`
}

func toCompanyCurrenciesJSON(list []currency.CompanyCurrency) []companyCurrencyJSON {
	out := make([]companyCurrencyJSON, 0, len(list))
	for _, c := range list {
		out = append(out, companyCurrencyJSON{ID: c.ID, Code: c.Code, Name: c.Name, Symbol: c.Symbol, Rate: c.Rate})
	}
	return out
}

// ratesJSON is a standard rate row: so'm per unit of each currency, four
// decimals, who set it and when.
type ratesJSON struct {
	ID        int64     `json:"id"`
	USD       string    `json:"usd"`
	EUR       string    `json:"eur"`
	RUB       string    `json:"rub"`
	SetByName *string   `json:"set_by_name"`
	SetAt     time.Time `json:"set_at"`
}

func toRatesJSON(r currency.Rates) ratesJSON {
	return ratesJSON{ID: r.ID, USD: r.USD, EUR: r.EUR, RUB: r.RUB, SetByName: r.SetByName, SetAt: r.SetAt}
}

type ratesPageJSON struct {
	Items    []ratesJSON `json:"items"`
	Total    int64       `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"page_size"`
}

// listRates is the history of the company's rates, the newest first
// (logic/currencies.md, section 4).
func (h *Handler) listRates(w http.ResponseWriter, r *http.Request) {
	page, ok := pageParam(w, r)
	if !ok {
		return
	}
	res, err := h.currencies.History(r.Context(), sessionCompany(r), page)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	items := make([]ratesJSON, 0, len(res.Items))
	for _, it := range res.Items {
		items = append(items, toRatesJSON(it))
	}
	httpx.JSON(w, http.StatusOK, ratesPageJSON{Items: items, Total: res.Total, Page: res.Page, PageSize: res.PageSize})
}

// setRates enters the rates of the currencies the company has on, as the
// member: a new standard row, from which the documents take their rates.
func (h *Handler) setRates(w http.ResponseWriter, r *http.Request) {
	var body struct {
		USD *string `json:"usd"`
		EUR *string `json:"eur"`
		RUB *string `json:"rub"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	rates, err := h.currencies.SetRates(r.Context(), sessionCompany(r), currentUser(r.Context()).Phone, currency.RatesInput{USD: body.USD, EUR: body.EUR, RUB: body.RUB})
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, toRatesJSON(rates))
}
