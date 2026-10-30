-- Optional defense-in-depth for Supabase.
--
-- The app connects server-side with a privileged connection string and
-- enforces user_id on every query (src/lib/repo.ts, src/app/actions.ts).
-- Enabling RLS with no permissive policies blocks Supabase's public
-- PostgREST/anon API from reading any of these tables, so the only way in is
-- the authenticated Next.js server. Run once in the Supabase SQL editor
-- after the app has created its tables.

do $$
declare t text;
begin
  foreach t in array array[
    'users','professional_profiles','linkedin_connections','documents','sources','companies','convention_participation',
    'recruiters','recruiter_evidence','jobs','job_eligibility','compatibility_assessments','company_tracking',
    'recruiter_contacts','interactions','outreach_drafts','applications','tasks','notes','chat_threads','data_imports',
    'schema_migrations'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from anon, authenticated', t);
  end loop;
end $$;
