-- name: UpsertTelegramContact :exec
-- Phones that are not users yet are stored too (no foreign key on purpose).
INSERT INTO telegram_contacts (chat_id, phone, username, first_name)
VALUES ($1, $2, $3, $4)
ON CONFLICT (chat_id) DO UPDATE
SET phone = EXCLUDED.phone,
    username = EXCLUDED.username,
    first_name = EXCLUDED.first_name,
    updated_at = now();

-- name: GetTelegramContactPhone :one
-- The phone a Telegram account shared with the user bot; pgx.ErrNoRows when
-- it never did (the user Mini App's sign-in).
SELECT phone FROM telegram_contacts WHERE chat_id = $1;

-- name: GetTelegramContactChat :one
-- The chat that shared the phone last, where a login code goes instead of an
-- SMS; pgx.ErrNoRows when no Telegram account shared it. A phone lives in
-- one Telegram account at a time, so the latest contact is its owner.
SELECT chat_id FROM telegram_contacts WHERE phone = $1 ORDER BY updated_at DESC LIMIT 1;
