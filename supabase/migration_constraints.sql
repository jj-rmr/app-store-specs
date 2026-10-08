-- Input validation at the database layer for databases created before this
-- file. Fresh installs get the same constraints from schema.sql. These mirror
-- the repo-layer limits, so the API can never persist what the UI refuses to
-- send — even for rows written outside the app. Run in the Supabase SQL
-- editor. Each statement is re-runnable (drops first). If a statement fails
-- on existing rows, legacy data violates that limit: trim the offending rows
-- and rerun (do not weaken the constraint to fit bad data).

-- ── Apps ────────────────────────────────────────────────────────────────
alter table apps drop constraint if exists apps_title_length;
alter table apps add constraint apps_title_length
  check (char_length(title) between 1 and 80);

alter table apps drop constraint if exists apps_description_length;
alter table apps add constraint apps_description_length
  check (char_length(description) between 1 and 280);

alter table apps drop constraint if exists apps_docs_length;
alter table apps add constraint apps_docs_length
  check (docs is null or char_length(docs) <= 50000);

alter table apps drop constraint if exists apps_category_valid;
alter table apps add constraint apps_category_valid
  check (category in ('Education', 'Productivity', 'Games', 'Creative'));

alter table apps drop constraint if exists apps_votes_nonnegative;
alter table apps add constraint apps_votes_nonnegative
  check (votes >= 0);

alter table apps drop constraint if exists apps_url_protocol;
alter table apps add constraint apps_url_protocol
  check (url is null or url ilike 'http://%' or url ilike 'https://%');

alter table apps drop constraint if exists apps_repo_url_protocol;
alter table apps add constraint apps_repo_url_protocol
  check (repo_url is null or repo_url ilike 'http://%' or repo_url ilike 'https://%');

-- ── Comments (project threads and wall threads share the table) ─────────
alter table comments drop constraint if exists comments_body_length;
alter table comments add constraint comments_body_length
  check (char_length(body) between 1 and 500);

alter table comments drop constraint if exists comments_likes_nonnegative;
alter table comments add constraint comments_likes_nonnegative
  check (likes >= 0);

-- ── Milestones wall ─────────────────────────────────────────────────────
alter table milestones drop constraint if exists milestones_body_length;
alter table milestones add constraint milestones_body_length
  check (char_length(body) between 1 and 280);

alter table milestones drop constraint if exists milestones_cheers_nonnegative;
alter table milestones add constraint milestones_cheers_nonnegative
  check (cheers >= 0);

-- ── Profiles ────────────────────────────────────────────────────────────
alter table profiles drop constraint if exists profiles_name_length;
alter table profiles add constraint profiles_name_length
  check (char_length(name) between 1 and 40);

alter table profiles drop constraint if exists profiles_role_length;
alter table profiles add constraint profiles_role_length
  check (char_length(role) between 1 and 80);

alter table profiles drop constraint if exists profiles_bio_length;
alter table profiles add constraint profiles_bio_length
  check (char_length(bio) <= 280);

alter table profiles drop constraint if exists profiles_color_valid;
alter table profiles add constraint profiles_color_valid
  check (color in ('yellow', 'mint', 'pink', 'sky', 'lavender', 'purple', 'paper', 'surface'));

alter table profiles drop constraint if exists profiles_theme_valid;
alter table profiles add constraint profiles_theme_valid
  check (theme is null or theme in ('pink', 'yellow', 'mint', 'sky', 'lavender', 'purple', 'black'));

-- ── Deliberately NOT constrained ─────────────────────────────────────────
-- profiles.name has no UNIQUE index: duplicate display names are legal and
-- the claim/merge flow exists to reconcile them. screenshots/collaborators
-- stay schemaless jsonb: unknown ids are render-skipped, never executed.
