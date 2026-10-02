package user

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

// Contacts keeps the phones people share with the user bot.
type Contacts struct {
	q *gen.Queries
}

// NewContacts wires the contacts store.
func NewContacts(pool *pgxpool.Pool) *Contacts {
	return &Contacts{q: gen.New(pool)}
}

// Save links a Telegram chat to a phone (normalized; a chat that shares
// another phone gets it updated) and says whether the phone is a user's.
// Phones that are not users yet are kept too.
func (c *Contacts) Save(ctx context.Context, chatID int64, rawPhone, username, firstName string) (bool, error) {
	phone, err := NormalizePhone(rawPhone)
	if err != nil {
		return false, err
	}
	if err := c.q.UpsertTelegramContact(ctx, gen.UpsertTelegramContactParams{
		ChatID:    chatID,
		Phone:     phone,
		Username:  optional(username),
		FirstName: optional(firstName),
	}); err != nil {
		return false, err
	}
	return c.q.UserExists(ctx, phone)
}

// optional is NULL for an empty string.
func optional(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
