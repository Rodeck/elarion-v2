-- 025_marketplace.sql
-- Player marketplace: listings, earnings, and building action type extension.

-- Extend building_actions.action_type to include 'marketplace'
ALTER TABLE building_actions
  DROP CONSTRAINT building_actions_action_type_check;
ALTER TABLE building_actions
  ADD CONSTRAINT building_actions_action_type_check
  CHECK (action_type IN ('travel', 'explore', 'expedition', 'gather', 'marketplace'));

-- Marketplace listings: one row per listed item stack
CREATE TABLE marketplace_listings (
  id                SERIAL       PRIMARY KEY,
  building_id       INTEGER      NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  seller_id         UUID         NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  item_def_id       INTEGER      NOT NULL REFERENCES item_definitions(id),
  quantity          SMALLINT     NOT NULL CHECK (quantity >= 1),
  price_per_item    INTEGER      NOT NULL CHECK (price_per_item >= 1),
  current_durability INTEGER     NULL,
  status            VARCHAR(16)  NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'sold', 'expired', 'cancelled')),
  seller_collected  BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expires_at        TIMESTAMPTZ  NOT NULL,
  sold_at           TIMESTAMPTZ  NULL,
  buyer_id          UUID         NULL REFERENCES characters(id)
);

-- Indexes for marketplace_listings
CREATE INDEX idx_listings_building_active ON marketplace_listings (building_id, status)
  WHERE status = 'active';
CREATE INDEX idx_listings_seller ON marketplace_listings (seller_id);
CREATE INDEX idx_listings_item_def ON marketplace_listings (item_def_id)
  WHERE status = 'active';
CREATE INDEX idx_listings_expires_at ON marketplace_listings (expires_at)
  WHERE status = 'active';

-- Marketplace earnings: accumulated crowns per seller per building
CREATE TABLE marketplace_earnings (
  id              SERIAL   PRIMARY KEY,
  building_id     INTEGER  NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  seller_id       UUID     NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  pending_crowns  INTEGER  NOT NULL DEFAULT 0 CHECK (pending_crowns >= 0),
  UNIQUE (building_id, seller_id)
);
