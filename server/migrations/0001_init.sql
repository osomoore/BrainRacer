CREATE TABLE families (
  id TEXT PRIMARY KEY NOT NULL,
  code_hash TEXT UNIQUE NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);

CREATE TABLE profiles (
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  rev INTEGER NOT NULL CHECK (rev > 0),
  updated_at INTEGER NOT NULL,
  deleted INTEGER NOT NULL CHECK (deleted IN (0, 1)),
  data TEXT NOT NULL,
  PRIMARY KEY (family_id, id)
);

CREATE INDEX profiles_by_update ON profiles(family_id, updated_at);

CREATE TABLE rate_limits (
  scope TEXT NOT NULL,
  key TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (scope, key)
);
