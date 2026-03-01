CREATE TABLE IF NOT EXISTS accounts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username     VARCHAR(32)  NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  banned_at    TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS accounts_username_lower_idx
  ON accounts (LOWER(username));
