package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/sms"
	"github.com/SalikhovID/hisob24/backend/internal/user"
)

const (
	// RefreshTokenTTL is how long a user app refresh token lives.
	RefreshTokenTTL = 30 * 24 * time.Hour
	smsCodeTTL      = 2 * time.Minute
	smsCooldown     = 60 // seconds between two codes to one phone
	smsMaxAttempts  = 5  // wrong codes before the code is dropped
)

// ErrTooSoon refuses a second code to a phone within a minute.
var ErrTooSoon = errors.New("a code went to this phone less than a minute ago")

// ErrInvalidRefresh is a refresh token that is unknown, used, revoked or
// expired.
var ErrInvalidRefresh = errors.New("invalid refresh token")

// ErrNotMember refuses a company the user is not a member of.
var ErrNotMember = errors.New("not a member of the company")

var errBadPhone = apperr.New(apperr.Invalid, "validation_error", "Telefon raqami noto'g'ri")

// UserAuth signs users in to the user app: a code by SMS, then an access
// token and a refresh token that renews it.
type UserAuth struct {
	pool            *pgxpool.Pool
	q               *gen.Queries
	otpSecret       []byte
	jwtSecret       []byte
	sender          sms.Sender
	now             func() time.Time
	newCode         func() (string, error)
	newRefreshToken func() (string, error)
}

// NewUserAuth wires the user app's sign-in. Codes are stored as HMACs with
// otpSecret; access tokens are signed with jwtSecret.
func NewUserAuth(pool *pgxpool.Pool, otpSecret, jwtSecret string, sender sms.Sender) *UserAuth {
	return &UserAuth{
		pool:      pool,
		q:         gen.New(pool),
		otpSecret: []byte(otpSecret),
		jwtSecret: []byte(jwtSecret),
		sender:    sender,
		now:       time.Now,
		newCode:   func() (string, error) { return NewCode(rand.Reader) },
		newRefreshToken: func() (string, error) {
			b := make([]byte, 32)
			if _, err := rand.Read(b); err != nil {
				return "", err
			}
			return base64.RawURLEncoding.EncodeToString(b), nil
		},
	}
}

// hashToken is how a refresh token is stored: 32 random bytes need no salt.
func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// SendCode texts a login code to phone, valid for two minutes; only its
// HMAC is stored.
func (a *UserAuth) SendCode(ctx context.Context, rawPhone string) error {
	phone, err := user.NormalizePhone(rawPhone)
	if err != nil {
		return errBadPhone
	}
	code, err := a.newCode()
	if err != nil {
		return err
	}
	stored, err := a.q.UpsertSMSCode(ctx, gen.UpsertSMSCodeParams{
		Phone:           phone,
		CodeHash:        HashCode(a.otpSecret, code),
		ExpiresAt:       a.now().Add(smsCodeTTL),
		CooldownSeconds: smsCooldown,
	})
	if err != nil {
		return err
	}
	if stored == 0 {
		return ErrTooSoon
	}
	// A phone that is not a user gets no SMS, but the same answer and a
	// code nobody will see: the replies tell nothing about who signs up.
	known, err := a.q.UserExists(ctx, phone)
	if err != nil {
		return err
	}
	if !known {
		return nil
	}
	if err := a.sender.Send(ctx, phone, sms.Text(code)); err != nil {
		// The SMS never left: no minute to wait before asking again.
		if dropErr := a.q.DeleteSMSCode(ctx, phone); dropErr != nil {
			return errors.Join(fmt.Errorf("send sms: %w", err), dropErr)
		}
		return fmt.Errorf("send sms: %w", err)
	}
	return nil
}

// Tokens is a user app sign-in: a short access token and the refresh token
// that renews it, for the company chosen (none while the user has to pick
// one of several).
type Tokens struct {
	AccessToken      string
	AccessExpiresAt  time.Time
	RefreshToken     string
	RefreshExpiresAt time.Time
	CompanyID        *int64
	Role             string
}

// Verify signs a user in with the code SendCode texted. A user of one
// company gets it chosen; with several, none is until switch-company.
func (a *UserAuth) Verify(ctx context.Context, rawPhone, code string) (Tokens, error) {
	phone, err := user.NormalizePhone(rawPhone)
	if err != nil {
		return Tokens{}, errBadPhone
	}
	var tokens Tokens
	err = pgx.BeginFunc(ctx, a.pool, func(tx pgx.Tx) error {
		q := a.q.WithTx(tx)
		if _, err := q.ConsumeSMSCode(ctx, gen.ConsumeSMSCodeParams{Phone: phone, CodeHash: HashCode(a.otpSecret, code)}); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return ErrInvalidCode
			}
			return err
		}
		// A stranger's code was never sent; even guessed, it signs in no one.
		known, err := q.UserExists(ctx, phone)
		if err != nil {
			return err
		}
		if !known {
			return ErrInvalidCode
		}
		companies, err := q.ListUserCompanies(ctx, phone)
		if err != nil {
			return err
		}
		var companyID *int64
		var role string
		if len(companies) == 1 {
			companyID, role = &companies[0].ID, companies[0].Role
		}
		tokens, err = a.issue(ctx, q, phone, companyID, role)
		return err
	})
	if errors.Is(err, ErrInvalidCode) {
		if countErr := a.countWrongCode(ctx, phone); countErr != nil {
			return Tokens{}, errors.Join(err, countErr)
		}
	}
	return tokens, err
}

// countWrongCode records a wrong attempt; the fifth drops the code.
func (a *UserAuth) countWrongCode(ctx context.Context, phone string) error {
	attempts, err := a.q.IncrementSMSCodeAttempts(ctx, phone)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil // no code to count against
	}
	if err != nil {
		return err
	}
	if attempts >= smsMaxAttempts {
		return a.q.DeleteSMSCode(ctx, phone)
	}
	return nil
}

// issue makes a new refresh token (stored as a hash, with the company) and
// an access token for the same company.
func (a *UserAuth) issue(ctx context.Context, q *gen.Queries, phone string, companyID *int64, role string) (Tokens, error) {
	refresh, err := a.newRefreshToken()
	if err != nil {
		return Tokens{}, err
	}
	now := a.now()
	if _, err := q.CreateRefreshToken(ctx, gen.CreateRefreshTokenParams{
		UserPhone: phone,
		TokenHash: hashToken(refresh),
		ExpiresAt: now.Add(RefreshTokenTTL),
		CompanyID: companyID,
	}); err != nil {
		return Tokens{}, err
	}
	access, accessExpires, err := IssueAccessToken(a.jwtSecret, AccessClaims{Phone: phone, CompanyID: companyID, Role: role}, now)
	if err != nil {
		return Tokens{}, err
	}
	return Tokens{
		AccessToken:      access,
		AccessExpiresAt:  accessExpires,
		RefreshToken:     refresh,
		RefreshExpiresAt: now.Add(RefreshTokenTTL),
		CompanyID:        companyID,
		Role:             role,
	}, nil
}

// Refresh rotates a refresh token in one transaction: it is revoked and a
// new one issued, for the company the old one remembered.
func (a *UserAuth) Refresh(ctx context.Context, refreshToken string) (Tokens, error) {
	var tokens Tokens
	err := pgx.BeginFunc(ctx, a.pool, func(tx pgx.Tx) error {
		q := a.q.WithTx(tx)
		revoked, err := q.RevokeRefreshToken(ctx, hashToken(refreshToken))
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrInvalidRefresh
		}
		if err != nil {
			return err
		}
		// The membership as it is now: a new role is taken, a lost one
		// leaves no company chosen.
		companyID, role := revoked.CompanyID, ""
		if companyID != nil {
			membership, err := q.GetUserCompany(ctx, gen.GetUserCompanyParams{UserPhone: revoked.UserPhone, CompanyID: *companyID})
			switch {
			case errors.Is(err, pgx.ErrNoRows):
				companyID = nil
			case err != nil:
				return err
			default:
				role = membership.Role
			}
		}
		tokens, err = a.issue(ctx, q, revoked.UserPhone, companyID, role)
		return err
	})
	return tokens, err
}

// SwitchCompany chooses one of the user's companies, in one transaction:
// the user's refresh token is replaced by one that remembers the company, so
// refreshing later keeps it.
func (a *UserAuth) SwitchCompany(ctx context.Context, phone, refreshToken string, companyID int64) (Tokens, error) {
	var tokens Tokens
	err := pgx.BeginFunc(ctx, a.pool, func(tx pgx.Tx) error {
		q := a.q.WithTx(tx)
		membership, err := q.GetUserCompany(ctx, gen.GetUserCompanyParams{UserPhone: phone, CompanyID: companyID})
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotMember
		}
		if err != nil {
			return err
		}
		revoked, err := q.RevokeRefreshToken(ctx, hashToken(refreshToken))
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrInvalidRefresh
		}
		if err != nil {
			return err
		}
		if revoked.UserPhone != phone {
			return ErrInvalidRefresh // rolled back: the owner keeps it
		}
		tokens, err = a.issue(ctx, q, phone, &companyID, membership.Role)
		return err
	})
	return tokens, err
}
