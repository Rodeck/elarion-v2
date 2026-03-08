CREATE TABLE IF NOT EXISTS image_prompt_templates (
  id          SERIAL        PRIMARY KEY,
  name        VARCHAR(128)  NOT NULL UNIQUE,
  body        TEXT          NOT NULL,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_config (
  key        VARCHAR(128)  PRIMARY KEY,
  value      TEXT          NOT NULL,
  updated_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
