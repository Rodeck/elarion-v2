CREATE TABLE IF NOT EXISTS map_zones (
  id           SMALLINT     PRIMARY KEY,
  name         VARCHAR(64)  NOT NULL UNIQUE,
  tmx_filename VARCHAR(128) NOT NULL,
  width_tiles  SMALLINT     NOT NULL,
  height_tiles SMALLINT     NOT NULL,
  spawn_x      SMALLINT     NOT NULL,
  spawn_y      SMALLINT     NOT NULL,
  min_level    SMALLINT     NOT NULL DEFAULT 1
);
