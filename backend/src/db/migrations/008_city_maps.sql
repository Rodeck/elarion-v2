-- 008_city_maps.sql
-- Adds city/image-map support: admin flag, image-based zones,
-- path graph (nodes + edges), buildings, and character node position.

-- 1. Admin flag on accounts
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Map-type and image metadata on map_zones
ALTER TABLE map_zones
  ADD COLUMN IF NOT EXISTS map_type         VARCHAR(16)  NOT NULL DEFAULT 'tile';
ALTER TABLE map_zones
  ADD COLUMN IF NOT EXISTS image_filename   VARCHAR(256);
ALTER TABLE map_zones
  ADD COLUMN IF NOT EXISTS image_width_px   INTEGER;
ALTER TABLE map_zones
  ADD COLUMN IF NOT EXISTS image_height_px  INTEGER;

-- 3. Path nodes (waypoints / spawn point for image-based zones)
CREATE TABLE IF NOT EXISTS path_nodes (
  id         SERIAL      PRIMARY KEY,
  zone_id    SMALLINT    NOT NULL REFERENCES map_zones(id) ON DELETE CASCADE,
  x          REAL        NOT NULL,
  y          REAL        NOT NULL,
  is_spawn   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one spawn node is allowed per zone
CREATE UNIQUE INDEX IF NOT EXISTS idx_path_nodes_spawn
  ON path_nodes (zone_id) WHERE is_spawn = TRUE;

CREATE INDEX IF NOT EXISTS idx_path_nodes_zone
  ON path_nodes (zone_id);

-- 4. Path edges (undirected graph edges between nodes within a zone)
CREATE TABLE IF NOT EXISTS path_edges (
  id           SERIAL   PRIMARY KEY,
  zone_id      SMALLINT NOT NULL REFERENCES map_zones(id)    ON DELETE CASCADE,
  from_node_id INTEGER  NOT NULL REFERENCES path_nodes(id)   ON DELETE CASCADE,
  to_node_id   INTEGER  NOT NULL REFERENCES path_nodes(id)   ON DELETE CASCADE,
  CONSTRAINT chk_edge_order CHECK (from_node_id < to_node_id),
  CONSTRAINT uq_edge        UNIQUE (zone_id, from_node_id, to_node_id)
);

CREATE INDEX IF NOT EXISTS idx_path_edges_zone
  ON path_edges (zone_id);

-- 5. Buildings (points of interest anchored to a path node)
CREATE TABLE IF NOT EXISTS buildings (
  id             SERIAL      PRIMARY KEY,
  zone_id        SMALLINT    NOT NULL REFERENCES map_zones(id)   ON DELETE CASCADE,
  node_id        INTEGER     NOT NULL REFERENCES path_nodes(id)  ON DELETE CASCADE,
  name           VARCHAR(64) NOT NULL,
  label_offset_x REAL        NOT NULL DEFAULT 0,
  label_offset_y REAL        NOT NULL DEFAULT -20,
  hotspot_type   VARCHAR(8)  CHECK (hotspot_type IN ('rect', 'circle')),
  hotspot_x      REAL,
  hotspot_y      REAL,
  hotspot_w      REAL,
  hotspot_h      REAL,
  hotspot_r      REAL
);

CREATE INDEX IF NOT EXISTS idx_buildings_zone
  ON buildings (zone_id);

-- 6. Current node position on characters (nullable — NULL for tile-map zones)
ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS current_node_id INTEGER REFERENCES path_nodes(id) ON DELETE SET NULL;
