CREATE TABLE IF NOT EXISTS chat_messages (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_character_id UUID         NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  channel             VARCHAR(8)   NOT NULL CHECK (channel IN ('local','global')),
  zone_id             SMALLINT     REFERENCES map_zones(id),
  message             VARCHAR(256) NOT NULL,
  sent_at             TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_messages_zone_sent_at_idx ON chat_messages (zone_id, sent_at);
CREATE INDEX IF NOT EXISTS chat_messages_sent_at_idx ON chat_messages (sent_at);
