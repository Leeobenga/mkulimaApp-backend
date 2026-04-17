CREATE TABLE IF NOT EXISTS crop_intelligence_history (
    id BIGSERIAL PRIMARY KEY,
    run_group_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    crop_id UUID REFERENCES crops(id) ON DELETE SET NULL,
    farm_id UUID REFERENCES farms(id) ON DELETE SET NULL,
    crop_type TEXT NOT NULL,
    stage TEXT,
    stage_source TEXT,
    county TEXT,
    subcounty TEXT,
    risk_score INTEGER,
    confidence_score INTEGER,
    model_version TEXT,
    drivers JSONB NOT NULL DEFAULT '[]'::jsonb,
    risks JSONB NOT NULL DEFAULT '[]'::jsonb,
    recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
    crop_input JSONB NOT NULL DEFAULT '{}'::jsonb,
    request_context JSONB NOT NULL DEFAULT '{}'::jsonb,
    weather_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    result_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crop_intelligence_history_user_created_at
    ON crop_intelligence_history(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crop_intelligence_history_user_crop_type_created_at
    ON crop_intelligence_history(user_id, crop_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crop_intelligence_history_run_group_id
    ON crop_intelligence_history(run_group_id);
