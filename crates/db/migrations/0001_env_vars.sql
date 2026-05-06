CREATE TABLE IF NOT EXISTS env_vars (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    key   TEXT NOT NULL,
    value TEXT NOT NULL,
    scope TEXT NOT NULL DEFAULT 'global',
    UNIQUE(key, scope)
);
