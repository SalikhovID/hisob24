package user

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNormalizePhone(t *testing.T) {
	tests := []struct {
		name    string
		raw     string
		want    string
		wantErr error
	}{
		{name: "already normalized", raw: "998901234567", want: "998901234567"},
		{name: "plus and spaces", raw: "+998 90 123 45 67", want: "998901234567"},
		{name: "parentheses and dashes", raw: "+998 (90) 123-45-67", want: "998901234567"},
		{name: "surrounding spaces", raw: "  998901234567 ", want: "998901234567"},
		{name: "foreign number", raw: "+7 (912) 345-67-89", want: "79123456789"},
		{name: "local number", raw: "901234567", want: "998901234567"},
		{name: "formatted local number", raw: "(90) 123-45-67", want: "998901234567"},
		{name: "letter", raw: "99890123456a", wantErr: ErrInvalidPhone},
		{name: "dots", raw: "998.90.123.45.67", wantErr: ErrInvalidPhone},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := NormalizePhone(tt.raw)
			if tt.wantErr != nil {
				assert.ErrorIs(t, err, tt.wantErr)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tt.want, got)
		})
	}
}
