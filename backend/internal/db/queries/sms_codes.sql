-- name: UpsertSMSCode :execrows
-- Stores a new code unless the last one went out less than cooldown_seconds
-- ago: 0 rows affected means "too soon" (429).
INSERT INTO sms_codes (phone, code_hash, expires_at)
VALUES ($1, $2, $3)
ON CONFLICT (phone) DO UPDATE
SET code_hash = EXCLUDED.code_hash,
    expires_at = EXCLUDED.expires_at,
    attempts = 0,
    sent_at = now()
WHERE sms_codes.sent_at <= now() - make_interval(secs => sqlc.arg(cooldown_seconds)::int);

-- name: ConsumeSMSCode :one
-- Deletes a matching live code: a code logs in once.
DELETE FROM sms_codes
WHERE phone = $1 AND code_hash = $2 AND expires_at > now()
RETURNING phone;

-- name: IncrementSMSCodeAttempts :one
-- Counts a wrong code; the caller deletes the code after the fifth.
UPDATE sms_codes SET attempts = attempts + 1
WHERE phone = $1
RETURNING attempts;
