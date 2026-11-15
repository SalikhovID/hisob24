package currency

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
)

// The admin picks where a company takes its rates and the step: a bank or
// manual, 1, 10, 100 or 1000; a new company has the central bank and 100.
func TestSetSourceOf(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := addCompany(t, pool, "Olma")

	got, err := s.SourceOf(ctx, olma)
	require.NoError(t, err)
	assert.Equal(t, RateSource{Source: "cbu", Rounding: 100}, got, "the central bank, to 100")

	set, err := s.SetSourceOf(ctx, olma, RateSource{Source: "manual", Rounding: 1000})
	require.NoError(t, err)
	assert.Equal(t, RateSource{Source: "manual", Rounding: 1000}, set)
	got, err = s.SourceOf(ctx, olma)
	require.NoError(t, err)
	assert.Equal(t, RateSource{Source: "manual", Rounding: 1000}, got)
	for _, source := range []string{"cbu", "kapitalbank", "ipakyuli", "asaka", "hamkor", "uzum", "ofb"} {
		for _, step := range []int{1, 10, 100, 1000} {
			_, err := s.SetSourceOf(ctx, olma, RateSource{Source: source, Rounding: step})
			assert.NoError(t, err, "%s to %d", source, step)
		}
	}

	_, err = s.SetSourceOf(ctx, olma, RateSource{Source: "nbu", Rounding: 100})
	refused(t, err, apperr.Invalid, "validation_error", "Manba noto'g'ri")
	_, err = s.SetSourceOf(ctx, olma, RateSource{Source: "carried", Rounding: 100})
	refused(t, err, apperr.Invalid, "validation_error", "Manba noto'g'ri", "where a row came from is no source")
	_, err = s.SetSourceOf(ctx, olma, RateSource{Source: "cbu", Rounding: 50})
	refused(t, err, apperr.Invalid, "validation_error", "Yaxlitlash noto'g'ri")
	_, err = s.SetSourceOf(ctx, olma+1000, RateSource{Source: "cbu", Rounding: 100})
	refused(t, err, apperr.NotFound, "not_found", "Kompaniya topilmadi")
	_, err = s.SourceOf(ctx, olma+1000)
	refused(t, err, apperr.NotFound, "not_found", "Kompaniya topilmadi")
}
