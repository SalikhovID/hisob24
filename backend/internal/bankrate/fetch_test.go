package bankrate

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// flaky is a server that fails the first requests, then answers with the
// body; hits counts every request.
func flaky(t *testing.T, failures int32, body []byte) (string, *atomic.Int32) {
	t.Helper()
	hits := &atomic.Int32{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		if hits.Add(1) <= failures {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		_, _ = w.Write(body)
	}))
	t.Cleanup(srv.Close)
	return srv.URL, hits
}

// never is how many failures a server that never answers has.
const never = 1 << 30

var (
	page     = []byte(`<html><body><p>USD 12 300</p><p>EUR 13 500</p><p>RUB 150</p></body></html>`)
	fromPage = Rates{USD: 12300, EUR: 13500, RUB: 150}
)

// The source's rates when it has them; the central bank is not asked.
func TestFetchTakesTheSourcesRates(t *testing.T) {
	cbu, cbuHits := flaky(t, 0, fixture(t, "cbu.json"))
	uzum, _ := flaky(t, 0, page)
	client := &Client{HTTP: http.DefaultClient, URLs: URLs{CBU: cbu, Uzum: uzum}, Attempts: 3, Pause: time.Millisecond}

	got, used, err := client.Fetch(t.Context(), Uzum)

	require.NoError(t, err)
	assert.Equal(t, fromPage, got)
	assert.Equal(t, Uzum, used)
	assert.Zero(t, cbuHits.Load(), "the central bank not asked")
}

// A source with no rates gives way to the central bank.
func TestFetchFallsBackToTheCentralBank(t *testing.T) {
	cbu, _ := flaky(t, 0, fixture(t, "cbu.json"))
	uzum, _ := flaky(t, never, nil)
	client := &Client{HTTP: http.DefaultClient, URLs: URLs{CBU: cbu, Uzum: uzum}, Attempts: 3, Pause: time.Millisecond}

	got, used, err := client.Fetch(t.Context(), Uzum)

	require.NoError(t, err)
	assert.Equal(t, CBU, used)
	assert.InDelta(t, 12014.37, got.USD, 1e-9)
}

// The chain is gone through again after a pause, Attempts times at most;
// the central bank as the source is asked once a time.
func TestFetchTriesAgainAfterAPause(t *testing.T) {
	cases := []struct {
		name               string
		source             string
		sourceFails        int32
		cbuFails           int32
		wantUsed           string
		fails              bool
		sourceHits, cbuHit int32
	}{
		{name: "the source answers the second time", source: Uzum, sourceFails: 1, cbuFails: never, wantUsed: Uzum, sourceHits: 2, cbuHit: 1},
		{name: "the central bank answers the third time", source: Uzum, sourceFails: never, cbuFails: 2, wantUsed: CBU, sourceHits: 3, cbuHit: 3},
		{name: "no bank answers", source: Uzum, sourceFails: never, cbuFails: never, fails: true, sourceHits: 3, cbuHit: 3},
		{name: "the central bank as the source", source: CBU, cbuFails: never, fails: true, cbuHit: 3},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			cbu, cbuHits := flaky(t, c.cbuFails, fixture(t, "cbu.json"))
			uzum, uzumHits := flaky(t, c.sourceFails, page)
			client := &Client{HTTP: http.DefaultClient, URLs: URLs{CBU: cbu, Uzum: uzum}, Attempts: 3, Pause: time.Millisecond}

			_, used, err := client.Fetch(t.Context(), c.source)

			if c.fails {
				assert.Error(t, err)
			} else {
				require.NoError(t, err)
				assert.Equal(t, c.wantUsed, used)
			}
			if c.source != CBU {
				assert.Equal(t, c.sourceHits, uzumHits.Load(), "the source asked")
			}
			assert.Equal(t, c.cbuHit, cbuHits.Load(), "the central bank asked")
		})
	}
}

// A pause ends when the context does.
func TestFetchStopsWaitingWhenTheContextEnds(t *testing.T) {
	cbu, _ := flaky(t, never, nil)
	client := &Client{HTTP: http.DefaultClient, URLs: URLs{CBU: cbu}, Attempts: 3, Pause: time.Hour}
	ctx, cancel := context.WithTimeout(t.Context(), 50*time.Millisecond)
	defer cancel()

	start := time.Now()
	_, _, err := client.Fetch(ctx, CBU)

	assert.Error(t, err)
	assert.Less(t, time.Since(start), 5*time.Second, "not an hour")
}
