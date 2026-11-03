-- Pet 后端一次性建表（对齐 docs/plan/集合与索引冻结.md，PostgreSQL）

CREATE TABLE IF NOT EXISTS users (
    openid TEXT PRIMARY KEY,
    nickname TEXT NOT NULL DEFAULT '',
    avatar_url TEXT NOT NULL DEFAULT '',
    created_at BIGINT NOT NULL,
    last_login_at BIGINT NOT NULL,
    last_scene TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active',
    revision BIGINT NOT NULL DEFAULT 0,
    resources JSONB NOT NULL DEFAULT '{}'::jsonb,
    reputation INT NOT NULL DEFAULT 0,
    flags JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS hospital_state (
    openid TEXT PRIMARY KEY REFERENCES users (openid) ON DELETE CASCADE,
    level INT NOT NULL DEFAULT 1,
    beds INT NOT NULL DEFAULT 0,
    rooms JSONB NOT NULL DEFAULT '[]'::jsonb,
    doctors JSONB NOT NULL DEFAULT '[]'::jsonb,
    decorations JSONB NOT NULL DEFAULT '[]'::jsonb,
    adoption_slots INT NOT NULL DEFAULT 0,
    reputation INT NOT NULL DEFAULT 0,
    season_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    revision BIGINT NOT NULL DEFAULT 0,
    updated_at BIGINT NOT NULL
);

-- pet_id 为配置物种键；多用户各养一只，唯一约束为 (openid, pet_id)
CREATE TABLE IF NOT EXISTS pets (
    id TEXT PRIMARY KEY,
    pet_id TEXT NOT NULL,
    openid TEXT,
    breed TEXT NOT NULL,
    name TEXT NOT NULL,
    rarity TEXT NOT NULL,
    story_id TEXT NOT NULL DEFAULT '',
    affection INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    adopted_by TEXT,
    case_session_id TEXT,
    care_score INT NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pets_openid_pet_id ON pets (openid, pet_id);
CREATE INDEX IF NOT EXISTS idx_pets_openid_status ON pets (openid, status);
CREATE INDEX IF NOT EXISTS idx_pets_adopted_by ON pets (adopted_by);

CREATE TABLE IF NOT EXISTS adoptions (
    id TEXT PRIMARY KEY,
    adoption_id TEXT NOT NULL UNIQUE,
    card_id TEXT NOT NULL UNIQUE,
    openid TEXT NOT NULL,
    pet_id TEXT NOT NULL,
    adopted_at BIGINT NOT NULL,
    is_first_adoption BOOLEAN NOT NULL DEFAULT FALSE,
    shared_count INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active'
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_adoptions_openid_pet_id ON adoptions (openid, pet_id);
CREATE INDEX IF NOT EXISTS idx_adoptions_openid_adopted ON adoptions (openid, adopted_at);

CREATE TABLE IF NOT EXISTS pets_cases (
    id TEXT PRIMARY KEY,
    case_session_id TEXT NOT NULL,
    openid TEXT NOT NULL,
    case_id TEXT NOT NULL,
    pet_species TEXT NOT NULL DEFAULT '',
    pet_name TEXT NOT NULL DEFAULT '',
    severity TEXT NOT NULL DEFAULT 'normal',
    diagnosis JSONB NOT NULL DEFAULT '{}'::jsonb,
    treatment JSONB NOT NULL DEFAULT '{}'::jsonb,
    affection INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    result JSONB NOT NULL,
    rewards JSONB NOT NULL,
    created_at BIGINT NOT NULL,
    finished_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pets_cases_openid ON pets_cases (openid);

CREATE TABLE IF NOT EXISTS config (
    id TEXT PRIMARY KEY,
    config_key TEXT NOT NULL,
    version INT NOT NULL,
    payload JSONB,
    status TEXT NOT NULL DEFAULT 'active',
    gray_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    gray_percent INT NOT NULL DEFAULT 100,
    UNIQUE (config_key, version)
);
CREATE INDEX IF NOT EXISTS idx_config_status ON config (status);

CREATE TABLE IF NOT EXISTS leaderboard (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    period TEXT NOT NULL,
    openid TEXT NOT NULL,
    score INT NOT NULL,
    nickname TEXT,
    rank INT,
    updated_at BIGINT NOT NULL,
    UNIQUE (type, period, openid)
);
CREATE INDEX IF NOT EXISTS idx_leaderboard_score ON leaderboard (type, period, score DESC, updated_at ASC);

CREATE TABLE IF NOT EXISTS assist_pairs (
    id TEXT PRIMARY KEY,
    target_id TEXT NOT NULL,
    helper_id TEXT NOT NULL,
    date TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    nonce TEXT NOT NULL,
    created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS assist_daily (
    id TEXT PRIMARY KEY,
    target_id TEXT NOT NULL,
    date TEXT NOT NULL,
    count INT NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS ad_events (
    id TEXT PRIMARY KEY,
    idempotency_key TEXT NOT NULL UNIQUE,
    ad_session_id TEXT NOT NULL,
    openid TEXT NOT NULL,
    ad_unit_id TEXT NOT NULL,
    scene TEXT NOT NULL,
    is_ended BOOLEAN NOT NULL,
    reward JSONB,
    granted BOOLEAN NOT NULL,
    daily_count INT NOT NULL DEFAULT 0,
    platform_date TEXT NOT NULL,
    created_at BIGINT NOT NULL,
    reconciled BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS ad_daily (
    id TEXT PRIMARY KEY,
    openid TEXT NOT NULL,
    date TEXT NOT NULL,
    count INT NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS track_events (
    id TEXT PRIMARY KEY,
    openid TEXT NOT NULL,
    batch_id TEXT NOT NULL,
    events JSONB NOT NULL,
    count INT NOT NULL,
    platform_date TEXT NOT NULL,
    created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_pending (
    id TEXT PRIMARY KEY,
    openid TEXT NOT NULL,
    case_session_id TEXT NOT NULL,
    case_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    first_seen_at BIGINT NOT NULL,
    last_seen_at BIGINT NOT NULL,
    last_code INT NOT NULL DEFAULT 2002
);
CREATE INDEX IF NOT EXISTS idx_sync_pending_first_seen ON sync_pending (first_seen_at);

CREATE TABLE IF NOT EXISTS habitat_state (
    openid TEXT PRIMARY KEY REFERENCES users (openid) ON DELETE CASCADE,
    last_claim_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS habitat_claims (
    id TEXT PRIMARY KEY,
    openid TEXT NOT NULL,
    date TEXT NOT NULL,
    count INT NOT NULL DEFAULT 0,
    hours INT NOT NULL DEFAULT 0,
    coins INT NOT NULL DEFAULT 0,
    updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    openid TEXT NOT NULL,
    client_order_id TEXT NOT NULL,
    sku_id TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at BIGINT NOT NULL,
    UNIQUE (openid, client_order_id)
);
