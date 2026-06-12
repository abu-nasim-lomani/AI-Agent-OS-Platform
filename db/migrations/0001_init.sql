-- 0001_init — Schema v0 + RLS (S0-03)
-- নকশা: docs/03-multi-tenancy-security.md §1–2 | docs/04 (versioning) | docs/10 (ledger)
-- নিয়ম:
--   1. প্রতিটি tenant-scoped table-এ org_id (denormalized) + RLS policy + (org_id, ...) leading index
--   2. App role-এর BYPASSRLS নেই; প্রতি transaction-এ SET LOCAL app.current_org_id
--   3. নতুন tenant table-এ RLS না থাকলে CI fail (S0-03-এর check script)

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

-- ── App role (RLS-এর অধীন; superuser/owner দিয়ে app চালানো নিষেধ) ──
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'agentos_app') THEN
    CREATE ROLE agentos_app LOGIN PASSWORD 'agentos_app_dev' NOBYPASSRLS;
  END IF;
END $$;

-- ── Tenancy core ─────────────────────────────────────────────────────
CREATE TABLE organizations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  plan        text NOT NULL DEFAULT 'trial',          -- trial|starter|growth|business|enterprise (docs/10 §2)
  industry    text,
  country     text DEFAULT 'BD',
  language    text DEFAULT 'both',                    -- bangla|english|both
  region      text NOT NULL DEFAULT 'ap-southeast-1', -- data residency (docs/03 §2.4)
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE workspaces (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        text NOT NULL DEFAULT 'Default',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  password_hash text,                                 -- null হলে OAuth-only
  name          text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE memberships (
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES workspaces(id),        -- null = org-wide (docs/03 §3.2)
  role         text NOT NULL DEFAULT 'member',        -- Phase 0: owner|member (F1); Phase 1: ৫ role
  PRIMARY KEY (user_id, org_id)
);

-- ── Agents (versioned — docs/04 §2) ──────────────────────────────────
CREATE TABLE agents (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workspace_id      uuid NOT NULL REFERENCES workspaces(id),
  name              text NOT NULL,
  status            text NOT NULL DEFAULT 'draft',    -- draft|training|ready|live|paused
  persona_config    jsonb NOT NULL DEFAULT '{}',      -- tone, language, welcome message (F2)
  model_profile     text NOT NULL DEFAULT 'economy',  -- plan-gated tier (docs/10 §2)
  active_version_id uuid,                             -- FK পরে যোগ (circular)
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE agent_versions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL,
  agent_id      uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  embedding_model text NOT NULL,                      -- knowledge-version-এ pinned (F4.4)
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── Knowledge (docs/04 §3) ───────────────────────────────────────────
CREATE TABLE knowledge_sources (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL,
  agent_id    uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  type        text NOT NULL,                          -- pdf|faq  (Phase 0 — docs/09 F3)
  name        text NOT NULL,
  status      text NOT NULL DEFAULT 'uploading',      -- uploading|processing|trained|failed (F3.4)
  error       text,
  s3_key      text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE chunks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL,
  agent_id     uuid NOT NULL,
  source_id    uuid NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE,
  version_id   uuid REFERENCES agent_versions(id),
  content      text NOT NULL,
  content_hash text NOT NULL,                         -- Smart Retraining diff (docs/04 §4)
  page         int,
  heading      text,
  -- DIM 1024 ⇔ .env EMBEDDING_DIM ⇔ gateway embed config — তিনটি একসাথে বদলাতে হবে (S0-07)
  embedding    vector(1024),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ── Conversations ────────────────────────────────────────────────────
CREATE TABLE conversations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL,
  agent_id    uuid NOT NULL REFERENCES agents(id),
  channel     text NOT NULL DEFAULT 'playground',     -- playground|widget|messenger
  end_user_id text,                                   -- visitor_id / PSID (docs/06 §1)
  controller  text NOT NULL DEFAULT 'ai',             -- ai|human|closed (docs/04 §8; Phase 0: ai)
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  direction       text NOT NULL,                      -- in|out
  content         jsonb NOT NULL,                     -- NormalizedMessage (packages/shared)
  citations       jsonb,
  is_unknown      boolean NOT NULL DEFAULT false,     -- Learning Loop signal (F8)
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE unknown_questions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL,
  agent_id    uuid NOT NULL,
  question    text NOT NULL,
  message_id  uuid REFERENCES messages(id),
  status      text NOT NULL DEFAULT 'pending',        -- pending|answered|dismissed (F8.2–8.3)
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Cost ledger (F10.5 — docs/10-এর reconcile এর data উৎস) ───────────
CREATE TABLE usage_ledger (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id         uuid NOT NULL,
  agent_id       uuid,
  kind           text NOT NULL,                       -- llm_reply|embedding|eval
  provider       text NOT NULL,
  model          text NOT NULL,
  input_tokens   int NOT NULL DEFAULT 0,
  output_tokens  int NOT NULL DEFAULT 0,
  cached_tokens  int NOT NULL DEFAULT 0,              -- cache hit metric (docs/10 §1)
  cost_usd       numeric(10,6) NOT NULL DEFAULT 0,    -- provider-reported usage × price
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ── Audit (append-only — docs/03 §4) ─────────────────────────────────
CREATE TABLE audit_logs (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id        uuid NOT NULL,
  actor_user_id uuid,
  actor_type    text NOT NULL DEFAULT 'user',
  action        text NOT NULL,
  resource_type text,
  resource_id   text,
  metadata      jsonb,
  ip_address    inet,
  created_at    timestamptz NOT NULL DEFAULT now()
);
REVOKE UPDATE, DELETE ON audit_logs FROM agentos_app;

-- ── Indexes: org_id সবসময় leading (docs/13 Q2 ফাঁদ #2) ───────────────
CREATE INDEX idx_workspaces_org      ON workspaces (org_id);
CREATE INDEX idx_memberships_org     ON memberships (org_id, user_id);
CREATE INDEX idx_agents_org          ON agents (org_id, workspace_id);
CREATE INDEX idx_agent_versions_org  ON agent_versions (org_id, agent_id);
CREATE INDEX idx_sources_org         ON knowledge_sources (org_id, agent_id);
CREATE INDEX idx_chunks_org_agent    ON chunks (org_id, agent_id);
CREATE INDEX idx_chunks_hash         ON chunks (org_id, source_id, content_hash);
CREATE INDEX idx_conversations_org   ON conversations (org_id, agent_id, created_at);
CREATE INDEX idx_messages_org_conv   ON messages (org_id, conversation_id, created_at);
CREATE INDEX idx_unknown_org         ON unknown_questions (org_id, agent_id, status);
CREATE INDEX idx_ledger_org_day      ON usage_ledger (org_id, created_at);
-- Vector index: এখন flat scan যথেষ্ট; HNSW S0-14 spike-এর benchmark report অনুযায়ী (docs/13 Q4)
-- CREATE INDEX idx_chunks_embedding ON chunks USING hnsw (embedding vector_cosine_ops);

-- ── RLS: প্রতিটি tenant table (docs/03 §2.2) ─────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'organizations','workspaces','memberships','agents','agent_versions',
    'knowledge_sources','chunks','conversations','messages',
    'unknown_questions','usage_ledger','audit_logs'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    -- missing_ok=true: context unset হলে error নয় — NULL তুলনা = শূন্য row (fail-closed)
    IF t = 'organizations' THEN
      EXECUTE format(
        'CREATE POLICY tenant_isolation ON %I USING (id = current_setting(''app.current_org_id'', true)::uuid)', t);
    ELSE
      EXECUTE format(
        'CREATE POLICY tenant_isolation ON %I USING (org_id = current_setting(''app.current_org_id'', true)::uuid)', t);
    END IF;
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO agentos_app', t);
  END LOOP;
END $$;

-- users টেবিল tenant-scoped নয় (এক user বহু org-এ থাকতে পারে) — access শুধু membership-পথে
GRANT SELECT, INSERT, UPDATE ON users TO agentos_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO agentos_app;

-- signup/auth path-এর জন্য নিয়ন্ত্রিত ব্যতিক্রম: org create + membership lookup
-- TODO(S0-05): signup flow-এ org bootstrap কোন role-এ হবে চূড়ান্ত করা
--   (option: SECURITY DEFINER function `create_organization(...)` — policy bypass নয়, নিয়ন্ত্রিত দরজা)
