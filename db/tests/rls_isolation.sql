-- RLS Isolation Test (S0-11, docs/03 §2.3, docs/13 Q2)
-- Architecture Review-এর #১ দাবি প্রমাণ: এক tenant আরেক tenant-এর data ছুঁতে পারে না,
-- এমনকি Application bug-এ WHERE org_id বাদ গেলেও — কারণ defense DB-স্তরে (RLS)।
--
-- চালানো (postgres container-এর ভেতরে, app role দিয়ে — superuser নয়):
--   docker compose exec -T postgres psql -U agentos_app -d agentos -v ON_ERROR_STOP=1 -f - < db/tests/rls_isolation.sql
-- সব assertion pass করলে শেষে 'RLS ISOLATION: ALL PASS' ছাপে; কোনোটা fail করলে RAISE EXCEPTION।
--
-- পূর্বশর্ত: migrations applied; agentos_app role NOBYPASSRLS (0001 নিশ্চিত করে)।

\set ON_ERROR_STOP on

DO $$
DECLARE
  org_a uuid;
  org_b uuid;
  user_a uuid;
  agent_a uuid;
  visible int;
BEGIN
  -- দুটি আলাদা tenant তৈরি — প্রতিটি নিজের context-এ (bootstrap_organization-এর মতোই)
  org_a := gen_random_uuid();
  org_b := gen_random_uuid();
  user_a := gen_random_uuid();

  -- Tenant A bootstrap
  PERFORM set_config('app.current_org_id', org_a::text, true);
  INSERT INTO organizations (id, name, plan) VALUES (org_a, 'Tenant A', 'starter');
  INSERT INTO users (id, email) VALUES (user_a, 'a@example.com');
  INSERT INTO workspaces (id, org_id, name) VALUES (gen_random_uuid(), org_a, 'Default');
  INSERT INTO agents (id, org_id, workspace_id, name)
    SELECT gen_random_uuid(), org_a, w.id, 'Agent A' FROM workspaces w WHERE w.org_id = org_a
    RETURNING id INTO agent_a;

  -- Tenant B bootstrap (আলাদা context)
  PERFORM set_config('app.current_org_id', org_b::text, true);
  INSERT INTO organizations (id, name, plan) VALUES (org_b, 'Tenant B', 'starter');
  INSERT INTO workspaces (id, org_id, name) VALUES (gen_random_uuid(), org_b, 'Default');

  -- ── Assertion 1: A-এর context-এ B-এর org দেখা যায় না ──────────────
  PERFORM set_config('app.current_org_id', org_a::text, true);
  SELECT count(*) INTO visible FROM organizations WHERE id = org_b;
  IF visible <> 0 THEN
    RAISE EXCEPTION 'FAIL#1: Tenant A can see Tenant B organization (got %)', visible;
  END IF;

  -- ── Assertion 2: A নিজের org দেখে ঠিকই ──────────────────────────────
  SELECT count(*) INTO visible FROM organizations;  -- WHERE নেই — RLS-ই filter
  IF visible <> 1 THEN
    RAISE EXCEPTION 'FAIL#2: Tenant A should see exactly 1 org, saw %', visible;
  END IF;

  -- ── Assertion 3: B-এর context-এ A-এর agent অদৃশ্য (WHERE org_id ছাড়াই) ──
  PERFORM set_config('app.current_org_id', org_b::text, true);
  SELECT count(*) INTO visible FROM agents;  -- বুদ্ধি করে WHERE বাদ — bug সিমুলেশন
  IF visible <> 0 THEN
    RAISE EXCEPTION 'FAIL#3: Tenant B sees Tenant A agents without filter (got %)', visible;
  END IF;

  -- ── Assertion 4: B সরাসরি A-এর agent_id চেয়েও পায় না ────────────────
  SELECT count(*) INTO visible FROM agents WHERE id = agent_a;
  IF visible <> 0 THEN
    RAISE EXCEPTION 'FAIL#4: Tenant B fetched Tenant A agent by id (got %)', visible;
  END IF;

  -- ── Assertion 5: context unset = fail-closed (শূন্য row, error নয়) ──
  PERFORM set_config('app.current_org_id', '', true);
  BEGIN
    SELECT count(*) INTO visible FROM agents;
  EXCEPTION WHEN others THEN
    visible := -1;  -- '' কে uuid cast করলে error হতে পারে — সেটাও fail-closed (access নেই)
  END;
  IF visible > 0 THEN
    RAISE EXCEPTION 'FAIL#5: unset context leaked % rows (expected 0 or error)', visible;
  END IF;

  -- Cleanup — superuser লাগে না, প্রতিটি delete নিজ context-এ
  PERFORM set_config('app.current_org_id', org_a::text, true);
  DELETE FROM organizations WHERE id = org_a;
  PERFORM set_config('app.current_org_id', org_b::text, true);
  DELETE FROM organizations WHERE id = org_b;

  RAISE NOTICE 'RLS ISOLATION: ALL PASS (5/5 assertions)';
END $$;
