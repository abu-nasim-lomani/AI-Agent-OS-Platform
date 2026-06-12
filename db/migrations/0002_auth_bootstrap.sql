-- 0002_auth_bootstrap — Auth v0-র নিয়ন্ত্রিত দরজা (S0-05, docs/09 F1)
-- নীতি: কোথাও RLS bypass নয় — bootstrap function নতুন org-এর id নিজে generate করে
-- transaction-local context-এ set করে, তারপর insert — সব row policy-র ভেতরেই।

-- Signup: user → org + default workspace + owner membership (F1.2, F1.5)
CREATE FUNCTION bootstrap_organization(p_org_name text, p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_org uuid := gen_random_uuid();
BEGIN
  -- is_local=true → শুধু এই transaction; নতুন org-ই caller-এর context হয়ে যায়
  PERFORM set_config('app.current_org_id', v_org::text, true);
  INSERT INTO organizations (id, name) VALUES (v_org, p_org_name);
  INSERT INTO workspaces (org_id, name) VALUES (v_org, 'Default');
  INSERT INTO memberships (user_id, org_id, role) VALUES (p_user_id, v_org, 'owner');
  RETURN v_org;
END;
$$;

GRANT EXECUTE ON FUNCTION bootstrap_organization(text, uuid) TO agentos_app;

-- Login: user নিজের membership দেখতে পারবে org context ছাড়াই —
-- দ্বিতীয় policy (policies OR হয়); app.current_user_id login path-এ set হয়
CREATE POLICY self_membership ON memberships
  USING (user_id = current_setting('app.current_user_id', true)::uuid);
