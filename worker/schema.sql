-- Схема D1 для бэкенда «Менеджера перевозок».
-- Применение: wrangler d1 execute transport-manager --remote --file=schema.sql (см. docs/backend.md)

CREATE TABLE IF NOT EXISTS players (
  id         INTEGER PRIMARY KEY,      -- Telegram user id
  name       TEXT NOT NULL,
  capital    INTEGER NOT NULL DEFAULT 0,
  level      INTEGER NOT NULL DEFAULT 1,
  trips      INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_players_capital ON players (capital DESC);

CREATE TABLE IF NOT EXISTS invoices (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  product    TEXT NOT NULL,
  stars      INTEGER NOT NULL,
  status     TEXT NOT NULL DEFAULT 'new',   -- new → paid → claimed
  created_at INTEGER NOT NULL,
  paid_at    INTEGER,
  claimed_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices (user_id);
