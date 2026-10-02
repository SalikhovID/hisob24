package auth

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/testutil/pgtest"
	"github.com/SalikhovID/hisob24/backend/internal/testutil/telegramtest"
)

const (
	testJWTSecret    = "test-jwt-secret"
	testUserBotToken = "4242:test-user-bot-token"
)

type sentSMS struct{ phone, text string }

// fakeSender records the SMS it is asked to send and fails with err.
type fakeSender struct {
	mu   sync.Mutex
	sent []sentSMS
	err  error
}

func (f *fakeSender) Send(_ context.Context, phone, text string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.sent = append(f.sent, sentSMS{phone, text})
	return f.err
}

func (f *fakeSender) messages() []sentSMS {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]sentSMS(nil), f.sent...)
}

func newUserAuth(t *testing.T) (*UserAuth, *pgxpool.Pool, *fakeSender) {
	t.Helper()
	t.Parallel()
	pool := pgtest.New(t)
	sender := &fakeSender{}
	a := NewUserAuth(pool, testOTPSecret, testJWTSecret, testUserBotToken, sender)
	a.newCode = codes("123456", "654321", "111111", "222222")
	return a, pool, sender
}

func addUser(t *testing.T, pool *pgxpool.Pool, phone string) {
	t.Helper()
	mustExec(t, pool, "INSERT INTO users (phone, full_name) VALUES ($1, 'Ali')", phone)
}

func TestSendCodeTextsAUserTheirCode(t *testing.T) {
	a, pool, sender := newUserAuth(t)
	addUser(t, pool, "998901234567")

	require.NoError(t, a.SendCode(t.Context(), "+998 90 123 45 67"))

	assert.Equal(t, []sentSMS{{"998901234567", "Hisob24 dasturiga kirish uchun tasdiqlash kodi: 123456 Uni hech kimga bermang."}}, sender.messages())
	var hash string
	var expiresAt time.Time
	require.NoError(t, pool.QueryRow(t.Context(), "SELECT code_hash, expires_at FROM sms_codes WHERE phone = '998901234567'").
		Scan(&hash, &expiresAt))
	assert.Equal(t, HashCode([]byte(testOTPSecret), "123456"), hash, "only the code's HMAC is stored")
	assert.WithinDuration(t, time.Now().Add(2*time.Minute), expiresAt, 5*time.Second)
}

func TestSendCodeToAStrangerSendsNothingButKeepsACode(t *testing.T) {
	a, pool, sender := newUserAuth(t)

	require.NoError(t, a.SendCode(t.Context(), "998909999999"))

	assert.Empty(t, sender.messages(), "no SMS to a phone that is not a user")
	var codes int
	require.NoError(t, pool.QueryRow(t.Context(), "SELECT count(*) FROM sms_codes WHERE phone = '998909999999'").Scan(&codes))
	assert.Equal(t, 1, codes, "a code is kept all the same, so a second request within a minute is refused alike")
}

func TestSendCodeAgainWithinAMinuteIsRefusedForEveryPhone(t *testing.T) {
	a, pool, sender := newUserAuth(t)
	addUser(t, pool, "998901234567")
	require.NoError(t, a.SendCode(t.Context(), "998901234567"))
	require.NoError(t, a.SendCode(t.Context(), "998909999999"))

	assert.ErrorIs(t, a.SendCode(t.Context(), "998901234567"), ErrTooSoon, "a user")
	assert.ErrorIs(t, a.SendCode(t.Context(), "998909999999"), ErrTooSoon, "a stranger alike")
	assert.Len(t, sender.messages(), 1, "no second SMS")
}

func TestSendCodeRefusesABadPhone(t *testing.T) {
	a, _, sender := newUserAuth(t)

	err := a.SendCode(t.Context(), "12ab")

	var e *apperr.Error
	require.ErrorAs(t, err, &e)
	assert.Equal(t, apperr.Invalid, e.Kind)
	assert.Equal(t, "Telefon raqami noto'g'ri", e.Message)
	assert.Empty(t, sender.messages())
}

func TestSendCodeThatCouldNotBeSentCanBeAskedForAgainAtOnce(t *testing.T) {
	a, pool, sender := newUserAuth(t)
	addUser(t, pool, "998901234567")
	sender.err = errors.New("eskiz is down")

	err := a.SendCode(t.Context(), "998901234567")

	require.Error(t, err)
	assert.NotErrorIs(t, err, ErrTooSoon)
	sender.err = nil
	assert.NoError(t, a.SendCode(t.Context(), "998901234567"), "no minute to wait for an SMS that never left")
}

func addCompany(t *testing.T, pool *pgxpool.Pool, name string, daysLeft int) int64 {
	t.Helper()
	var id int64
	require.NoError(t, pool.QueryRow(t.Context(),
		"INSERT INTO companies (name, end_date) VALUES ($1, CURRENT_DATE + $2::int) RETURNING id", name, daysLeft).Scan(&id))
	return id
}

func addMember(t *testing.T, pool *pgxpool.Pool, phone string, companyID int64, role string) {
	t.Helper()
	mustExec(t, pool, "INSERT INTO user_companies (user_phone, company_id, role) VALUES ($1, $2, $3)", phone, companyID, role)
}

func TestVerifySignsInAUserOfOneCompany(t *testing.T) {
	a, pool, _ := newUserAuth(t)
	a.newRefreshToken = func() (string, error) { return "refresh-1", nil }
	addUser(t, pool, "998901234567")
	companyID := addCompany(t, pool, "Olma", 30)
	addMember(t, pool, "998901234567", companyID, "manager")
	require.NoError(t, a.SendCode(t.Context(), "998901234567"))

	tokens, err := a.Verify(t.Context(), "+998 90 123 45 67", "123456")

	require.NoError(t, err)
	require.NotNil(t, tokens.CompanyID)
	assert.Equal(t, companyID, *tokens.CompanyID, "the only company is chosen")
	assert.Equal(t, "manager", tokens.Role)
	claims, err := ParseAccessToken([]byte(testJWTSecret), tokens.AccessToken, time.Now())
	require.NoError(t, err)
	assert.Equal(t, AccessClaims{Phone: "998901234567", CompanyID: &companyID, Role: "manager"}, claims)
	assert.Equal(t, "refresh-1", tokens.RefreshToken)
	assert.WithinDuration(t, time.Now().Add(30*24*time.Hour), tokens.RefreshExpiresAt, 5*time.Second)
	var hash string
	var stored *int64
	require.NoError(t, pool.QueryRow(t.Context(), "SELECT token_hash, company_id FROM refresh_tokens WHERE user_phone = '998901234567'").
		Scan(&hash, &stored))
	assert.NotEqual(t, "refresh-1", hash, "only the refresh token's hash is stored")
	require.NotNil(t, stored)
	assert.Equal(t, companyID, *stored, "the refresh token remembers the company")

	_, err = a.Verify(t.Context(), "998901234567", "123456")
	assert.ErrorIs(t, err, ErrInvalidCode, "a code signs in once")
}

func TestVerifyLeavesTheChoiceToAUserOfSeveralCompanies(t *testing.T) {
	a, pool, _ := newUserAuth(t)
	addUser(t, pool, "998901234567")
	addMember(t, pool, "998901234567", addCompany(t, pool, "Olma", 30), "owner")
	addMember(t, pool, "998901234567", addCompany(t, pool, "Nok", 30), "staff")
	require.NoError(t, a.SendCode(t.Context(), "998901234567"))

	tokens, err := a.Verify(t.Context(), "998901234567", "123456")

	require.NoError(t, err)
	assert.Nil(t, tokens.CompanyID, "the app asks which one (/select-company)")
	assert.Empty(t, tokens.Role)
	claims, err := ParseAccessToken([]byte(testJWTSecret), tokens.AccessToken, time.Now())
	require.NoError(t, err)
	assert.Nil(t, claims.CompanyID)
}

func TestVerifyCountsWrongCodesAndDropsTheCodeAfterFive(t *testing.T) {
	a, pool, _ := newUserAuth(t)
	addUser(t, pool, "998901234567")
	require.NoError(t, a.SendCode(t.Context(), "998901234567"))

	for range 4 {
		_, err := a.Verify(t.Context(), "998901234567", "000000")
		require.ErrorIs(t, err, ErrInvalidCode)
	}
	var attempts int
	require.NoError(t, pool.QueryRow(t.Context(), "SELECT attempts FROM sms_codes WHERE phone = '998901234567'").Scan(&attempts))
	assert.Equal(t, 4, attempts)

	_, err := a.Verify(t.Context(), "998901234567", "000000")
	require.ErrorIs(t, err, ErrInvalidCode)
	_, err = a.Verify(t.Context(), "998901234567", "123456")
	assert.ErrorIs(t, err, ErrInvalidCode, "after the fifth wrong code the code is gone")
}

func TestVerifyRefusesAnExpiredCode(t *testing.T) {
	a, pool, _ := newUserAuth(t)
	addUser(t, pool, "998901234567")
	require.NoError(t, a.SendCode(t.Context(), "998901234567"))
	mustExec(t, pool, "UPDATE sms_codes SET expires_at = now() - interval '1 second'")

	_, err := a.Verify(t.Context(), "998901234567", "123456")

	assert.ErrorIs(t, err, ErrInvalidCode)
}

func TestVerifyGivesAStrangerNothing(t *testing.T) {
	a, _, _ := newUserAuth(t)
	require.NoError(t, a.SendCode(t.Context(), "998909999999"))

	_, err := a.Verify(t.Context(), "998909999999", "123456")

	assert.ErrorIs(t, err, ErrInvalidCode, "even the right code signs in no one")
}

// signIn makes phone a user of the companies (id → role) and signs them in.
func signIn(t *testing.T, a *UserAuth, pool *pgxpool.Pool, phone string, roles map[int64]string) Tokens {
	t.Helper()
	addUser(t, pool, phone)
	for companyID, role := range roles {
		addMember(t, pool, phone, companyID, role)
	}
	a.newCode = codes("123456")
	require.NoError(t, a.SendCode(t.Context(), phone))
	tokens, err := a.Verify(t.Context(), phone, "123456")
	require.NoError(t, err)
	return tokens
}

func TestRefreshRotatesTheTokenAndKeepsTheCompany(t *testing.T) {
	a, pool, _ := newUserAuth(t)
	a.newRefreshToken = codes("refresh-1", "refresh-2")
	companyID := addCompany(t, pool, "Olma", 30)
	first := signIn(t, a, pool, "998901234567", map[int64]string{companyID: "owner"})

	second, err := a.Refresh(t.Context(), first.RefreshToken)

	require.NoError(t, err)
	assert.Equal(t, "refresh-2", second.RefreshToken)
	require.NotNil(t, second.CompanyID)
	assert.Equal(t, companyID, *second.CompanyID, "the company is kept")
	assert.Equal(t, "owner", second.Role)
	claims, err := ParseAccessToken([]byte(testJWTSecret), second.AccessToken, time.Now())
	require.NoError(t, err)
	assert.Equal(t, AccessClaims{Phone: "998901234567", CompanyID: &companyID, Role: "owner"}, claims)

	_, err = a.Refresh(t.Context(), first.RefreshToken)
	assert.ErrorIs(t, err, ErrInvalidRefresh, "a refresh token is used once")
	_, err = a.Refresh(t.Context(), "made-up")
	assert.ErrorIs(t, err, ErrInvalidRefresh)
}

func TestRefreshFollowsTheMembershipAsItIsNow(t *testing.T) {
	a, pool, _ := newUserAuth(t)
	a.newRefreshToken = codes("refresh-1", "refresh-2", "refresh-3")
	companyID := addCompany(t, pool, "Olma", 30)
	first := signIn(t, a, pool, "998901234567", map[int64]string{companyID: "staff"})

	mustExec(t, pool, "UPDATE user_companies SET role = 'manager'")
	second, err := a.Refresh(t.Context(), first.RefreshToken)
	require.NoError(t, err)
	assert.Equal(t, "manager", second.Role, "the role as it is now")

	mustExec(t, pool, "DELETE FROM user_companies")
	third, err := a.Refresh(t.Context(), second.RefreshToken)
	require.NoError(t, err)
	assert.Nil(t, third.CompanyID, "no longer a member: the company is not kept")
	assert.Empty(t, third.Role)
}

func TestSwitchCompanyChoosesACompanyAndTheRefreshTokenRemembersIt(t *testing.T) {
	a, pool, _ := newUserAuth(t)
	a.newRefreshToken = codes("refresh-1", "refresh-2", "refresh-3")
	olma := addCompany(t, pool, "Olma", 30)
	nok := addCompany(t, pool, "Nok", 30)
	first := signIn(t, a, pool, "998901234567", map[int64]string{olma: "owner", nok: "staff"})

	switched, err := a.SwitchCompany(t.Context(), "998901234567", first.RefreshToken, &nok)

	require.NoError(t, err)
	require.NotNil(t, switched.CompanyID)
	assert.Equal(t, nok, *switched.CompanyID)
	assert.Equal(t, "staff", switched.Role)
	assert.Equal(t, "refresh-2", switched.RefreshToken, "a new refresh token for the new company")
	_, err = a.Refresh(t.Context(), first.RefreshToken)
	assert.ErrorIs(t, err, ErrInvalidRefresh, "the old one is revoked")
	refreshed, err := a.Refresh(t.Context(), switched.RefreshToken)
	require.NoError(t, err)
	require.NotNil(t, refreshed.CompanyID)
	assert.Equal(t, nok, *refreshed.CompanyID, "a reload keeps the chosen company")
}

func TestSwitchCompanyRefusals(t *testing.T) {
	a, pool, _ := newUserAuth(t)
	olma := addCompany(t, pool, "Olma", 30)
	other := addCompany(t, pool, "Begona", 30)
	mine := signIn(t, a, pool, "998901234567", map[int64]string{olma: "owner"})
	theirs := signIn(t, a, pool, "998902223344", map[int64]string{olma: "staff"})

	_, err := a.SwitchCompany(t.Context(), "998901234567", mine.RefreshToken, &other)
	assert.ErrorIs(t, err, ErrNotMember)
	_, err = a.SwitchCompany(t.Context(), "998901234567", theirs.RefreshToken, &olma)
	assert.ErrorIs(t, err, ErrInvalidRefresh, "someone else's refresh token")
	_, err = a.SwitchCompany(t.Context(), "998901234567", "made-up", &olma)
	assert.ErrorIs(t, err, ErrInvalidRefresh)

	_, err = a.Refresh(t.Context(), theirs.RefreshToken)
	assert.NoError(t, err, "a refused switch leaves the other user's token alone")
	_, err = a.Refresh(t.Context(), mine.RefreshToken)
	assert.NoError(t, err, "and the user's own")
}

func TestLogoutRevokesTheRefreshToken(t *testing.T) {
	a, pool, _ := newUserAuth(t)
	tokens := signIn(t, a, pool, "998901234567", nil)

	require.NoError(t, a.Logout(t.Context(), tokens.RefreshToken))

	_, err := a.Refresh(t.Context(), tokens.RefreshToken)
	assert.ErrorIs(t, err, ErrInvalidRefresh)
	assert.NoError(t, a.Logout(t.Context(), tokens.RefreshToken), "twice is fine")
	assert.NoError(t, a.Logout(t.Context(), "made-up"))
}

func TestAFailedSignInLeavesTheCodeAndTheTokensAsTheyWere(t *testing.T) {
	a, pool, _ := newUserAuth(t)
	companyID := addCompany(t, pool, "Olma", 30)
	tokens := signIn(t, a, pool, "998901234567", map[int64]string{companyID: "owner"})
	a.newCode = codes("123456")
	require.NoError(t, a.SendCode(t.Context(), "998901234567"))
	pgtest.FailInserts(t, pool, "refresh_tokens")

	_, err := a.Verify(t.Context(), "998901234567", "123456")
	require.Error(t, err)
	_, err = a.Refresh(t.Context(), tokens.RefreshToken)
	require.Error(t, err)
	_, err = a.SwitchCompany(t.Context(), "998901234567", tokens.RefreshToken, &companyID)
	require.Error(t, err)

	var codes, live int
	require.NoError(t, pool.QueryRow(t.Context(), `SELECT
		(SELECT count(*) FROM sms_codes WHERE phone = '998901234567'),
		(SELECT count(*) FROM refresh_tokens WHERE revoked_at IS NULL)`).Scan(&codes, &live))
	assert.Equal(t, 1, codes, "Verify used no code it could not finish with")
	assert.Equal(t, 1, live, "Refresh and SwitchCompany revoked no token they could not replace")
}

func TestAuthenticateAcceptsTheAccessTokensItIssued(t *testing.T) {
	a, pool, _ := newUserAuth(t)
	companyID := addCompany(t, pool, "Olma", 30)
	tokens := signIn(t, a, pool, "998901234567", map[int64]string{companyID: "owner"})

	claims, err := a.Authenticate(tokens.AccessToken)

	require.NoError(t, err)
	assert.Equal(t, AccessClaims{Phone: "998901234567", CompanyID: &companyID, Role: "owner"}, claims)
	_, err = a.Authenticate("abc.def.ghi")
	assert.ErrorIs(t, err, ErrInvalidAccessToken)
	_, err = NewUserAuth(pool, testOTPSecret, "another-secret", testUserBotToken, &fakeSender{}).Authenticate(tokens.AccessToken)
	assert.ErrorIs(t, err, ErrInvalidAccessToken, "signed with JWT_SECRET only")
}

func TestSwitchCompanyToNoneClearsTheChoice(t *testing.T) {
	a, pool, _ := newUserAuth(t)
	olma := addCompany(t, pool, "Olma", -3)
	first := signIn(t, a, pool, "998901234567", map[int64]string{olma: "owner"})

	cleared, err := a.SwitchCompany(t.Context(), "998901234567", first.RefreshToken, nil)

	require.NoError(t, err)
	assert.Nil(t, cleared.CompanyID, "no company chosen: the app shows the list")
	assert.Empty(t, cleared.Role)
	_, err = a.Refresh(t.Context(), first.RefreshToken)
	assert.ErrorIs(t, err, ErrInvalidRefresh, "the old refresh token is replaced")
	refreshed, err := a.Refresh(t.Context(), cleared.RefreshToken)
	require.NoError(t, err)
	assert.Nil(t, refreshed.CompanyID, "and the new one remembers no company")
}

// linkContact stands for the user bot: the Telegram account shared phone.
func linkContact(t *testing.T, pool *pgxpool.Pool, telegramID int64, phone string) {
	t.Helper()
	mustExec(t, pool, "INSERT INTO telegram_contacts (chat_id, phone) VALUES ($1, $2)", telegramID, phone)
}

func TestLoginWithTelegramSignsInALinkedUser(t *testing.T) {
	a, pool, _ := newUserAuth(t)
	addUser(t, pool, "998901234567")
	olma := addCompany(t, pool, "Olma", 30)
	addMember(t, pool, "998901234567", olma, "owner")
	linkContact(t, pool, 1001, "998901234567")
	addUser(t, pool, "998902223344")
	addMember(t, pool, "998902223344", olma, "manager")
	addMember(t, pool, "998902223344", addCompany(t, pool, "Nok", 30), "owner")
	linkContact(t, pool, 1002, "998902223344")

	one, err := a.LoginWithTelegram(t.Context(), telegramtest.SignInitData(testUserBotToken, 1001, time.Now()))

	require.NoError(t, err)
	require.NotNil(t, one.CompanyID, "one company is chosen, as with the SMS code")
	assert.Equal(t, olma, *one.CompanyID)
	assert.Equal(t, "owner", one.Role)
	assert.Equal(t, "telegram", one.Source)
	claims, err := a.Authenticate(one.AccessToken)
	require.NoError(t, err)
	assert.Equal(t, "998901234567", claims.Phone)

	several, err := a.LoginWithTelegram(t.Context(), telegramtest.SignInitData(testUserBotToken, 1002, time.Now()))

	require.NoError(t, err)
	assert.Nil(t, several.CompanyID, "with several the user chooses")
	assert.Equal(t, "telegram", several.Source)
}

func TestLoginWithTelegramWithoutASharedPhone(t *testing.T) {
	a, _, _ := newUserAuth(t)

	_, err := a.LoginWithTelegram(t.Context(), telegramtest.SignInitData(testUserBotToken, 1004, time.Now()))

	assert.ErrorIs(t, err, ErrPhoneNotShared)
}

func TestLoginWithTelegramForAPhoneThatIsNoUsers(t *testing.T) {
	a, pool, _ := newUserAuth(t)
	linkContact(t, pool, 1003, "998905556677")

	_, err := a.LoginWithTelegram(t.Context(), telegramtest.SignInitData(testUserBotToken, 1003, time.Now()))

	var noAccess NoAccessError
	require.ErrorAs(t, err, &noAccess)
	assert.Equal(t, "998905556677", noAccess.Phone)
}

func TestLoginWithTelegramTrustsOnlyTheUserBotsFreshSignature(t *testing.T) {
	a, pool, _ := newUserAuth(t)
	addUser(t, pool, "998901234567")
	linkContact(t, pool, 1001, "998901234567")

	for name, initData := range map[string]string{
		"another bot's":   telegramtest.SignInitData("4243:another-bot", 1001, time.Now()),
		"a day and more":  telegramtest.SignInitData(testUserBotToken, 1001, time.Now().Add(-25*time.Hour)),
		"not initData":    "user=%7B%22id%22%3A1001%7D&hash=00",
		"an empty secret": telegramtest.SignInitData("", 1001, time.Now()),
	} {
		_, err := a.LoginWithTelegram(t.Context(), initData)
		assert.ErrorIs(t, err, ErrInvalidInitData, name)
	}
	_, err := NewUserAuth(pool, testOTPSecret, testJWTSecret, "", &fakeSender{}).
		LoginWithTelegram(t.Context(), telegramtest.SignInitData("", 1001, time.Now()))
	assert.ErrorIs(t, err, ErrInvalidInitData, "no user bot: no Mini App sign-in, even signed with an empty token")
}

func TestTheSessionKeepsWhereItBegan(t *testing.T) {
	a, pool, _ := newUserAuth(t)
	olma := addCompany(t, pool, "Olma", 30)
	nok := addCompany(t, pool, "Nok", 30)
	viaSMS := signIn(t, a, pool, "998901234567", map[int64]string{olma: "owner", nok: "staff"})
	assert.Equal(t, "sms", viaSMS.Source)
	linkContact(t, pool, 1001, "998901234567")

	viaTelegram, err := a.LoginWithTelegram(t.Context(), telegramtest.SignInitData(testUserBotToken, 1001, time.Now()))
	require.NoError(t, err)
	refreshed, err := a.Refresh(t.Context(), viaTelegram.RefreshToken)
	require.NoError(t, err)
	switched, err := a.SwitchCompany(t.Context(), "998901234567", refreshed.RefreshToken, &nok)
	require.NoError(t, err)
	smsRefreshed, err := a.Refresh(t.Context(), viaSMS.RefreshToken)
	require.NoError(t, err)

	assert.Equal(t, "telegram", refreshed.Source, "refresh")
	assert.Equal(t, "telegram", switched.Source, "switch-company")
	assert.Equal(t, "sms", smsRefreshed.Source, "an SMS session stays one")
}
