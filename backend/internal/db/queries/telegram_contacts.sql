-- name: UpsertTelegramContact :exec
-- Phones that are not users yet are stored too (no foreign key on purpose).
INSERT INTO telegram_contacts (chat_id, phone, username, first_name)
VALUES ($1, $2, $3, $4)
ON CONFLICT (chat_id) DO UPDATE
SET phone = EXCLUDED.phone,
    username = EXCLUDED.username,
    first_name = EXCLUDED.first_name,
    updated_at = now();
