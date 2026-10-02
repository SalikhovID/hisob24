package auth

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// sampleToken and sampleInitData are the example of the telegram-mini-apps
// docs; its hash was re-computed with the algorithm described at
// core.telegram.org/bots/webapps before it went in here.
const (
	sampleToken    = "5768337691:AAH5YkoiEuPk8-FZa32hStHTqXiLPtAEhx8"
	sampleInitData = "query_id=AAHdF6IQAAAAAN0XohDhrOrc&user=%7B%22id%22%3A279058397%2C%22first_name%22%3A%22Vladislav%22%2C%22last_name%22%3A%22Kibenko%22%2C%22username%22%3A%22vdkfrost%22%2C%22language_code%22%3A%22ru%22%2C%22is_premium%22%3Atrue%7D&auth_date=1662771648&hash=c501b71e775f74ce10e377dea85a7ea24ecd640b223ea86dfe453e0eaed2e2b2"
)

var sampleSigned = time.Unix(1662771648, 0)

func TestValidateInitDataAcceptsTheDocsSample(t *testing.T) {
	user, err := ValidateInitData(sampleInitData, sampleToken, 24*time.Hour, sampleSigned.Add(time.Hour))

	require.NoError(t, err)
	assert.Equal(t, WebAppUser{ID: 279058397, FirstName: "Vladislav", LastName: "Kibenko", Username: "vdkfrost"}, user)
}
