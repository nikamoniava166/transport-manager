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

-- Резервные копии полных сейвов (для восстановления, если пропали localStorage и CloudStorage)
CREATE TABLE IF NOT EXISTS saves (
  user_id    INTEGER PRIMARY KEY,      -- Telegram user id
  state      TEXT NOT NULL,            -- полный JSON сейва
  updated_at INTEGER NOT NULL
);

-- Бонусы игрокам: создаёт владелец игры (INSERT), клиент забирает одноразово через /grant
CREATE TABLE IF NOT EXISTS grants (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  kind       TEXT NOT NULL,            -- пока только 'money'
  amount     INTEGER NOT NULL,
  note       TEXT,
  created_at INTEGER NOT NULL,
  claimed_at INTEGER                   -- заполнено = забрано клиентом
);

-- Реферальная программа: пара «кто кого пригласил»; referee уникален —
-- игрок учитывается как приглашённый только один раз, награда одноразовая (credited_at)
CREATE TABLE IF NOT EXISTS referrals (
  referee    INTEGER PRIMARY KEY,      -- Telegram user_id приглашённого
  referrer   INTEGER NOT NULL,         -- Telegram user_id пригласившего
  created_at INTEGER NOT NULL,
  credited_at INTEGER                 -- заполнено = награда пригласившему выдана
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals (referrer);
