-- Specs App Store — Supabase schema.
-- Mirrors the localStorage prototype stores 1:1 so cutover is mechanical.
-- Run in the Supabase SQL editor. Requires pgcrypto for gen_random_uuid().
--
-- Stores replaced by these tables:
--   cc.apps.v1        -> apps (+ app_votes for votes/viewerHasVoted)
--   cc.profiles.v1    -> profiles
--   cc.comments.v1    -> comments (parent_id self-ref for nested replies)
--                      + comment_likes (likes/viewerHasLiked)
--   cc.milestones.v1  -> milestones + milestone_cheers
--   cc.session / mock users -> Supabase Auth (auth.users), linked by id
--
-- NOTE: screenshots/docs are data URLs in the prototype. In production put
-- image blobs in a Supabase Storage bucket and store public URLs instead.

create extension if not exists "pgcrypto";

-- ── Profiles ──────────────────────────────────────────────────────────────
create table if not exists profiles (
  id text primary key, -- matches auth user id (mock/google ids during prototype)
  name text not null,
  role text not null default 'SPECS member',
  bio text not null default '',
  color text not null default 'sky',
  image_url text,
  created_at timestamptz not null default now()
);

-- ── Apps ──────────────────────────────────────────────────────────────────
create table if not exists apps (
  id text primary key,
  title text not null,
  description text not null,
  creator text not null,
  creator_id text,
  category text not null,
  votes integer not null default 0,
  color text not null,
  url text,
  repo_url text,
  screenshots jsonb not null default '[]',
  docs text,
  collaborators jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- One row per upvote. votes column is a cached count; viewerHasVoted = own row exists.
create table if not exists app_votes (
  app_id text not null references apps (id) on delete cascade,
  user_id text not null,
  created_at timestamptz not null default now(),
  primary key (app_id, user_id)
);

-- ── Comments (nested replies via parent_id) ───────────────────────────────
create table if not exists comments (
  id text primary key,
  app_id text not null, -- real app id, or 'ms:<milestoneId>' for wall threads
  author_id text not null,
  author_name text not null,
  body text not null,
  parent_id text references comments (id) on delete cascade,
  likes integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists comment_likes (
  comment_id text not null references comments (id) on delete cascade,
  user_id text not null,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

-- ── Milestones wall ───────────────────────────────────────────────────────
create table if not exists milestones (
  id text primary key,
  author_id text not null,
  author_name text not null,
  body text not null,
  app_id text references apps (id) on delete set null,
  cheers integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists milestone_cheers (
  milestone_id text not null references milestones (id) on delete cascade,
  user_id text not null,
  created_at timestamptz not null default now(),
  primary key (milestone_id, user_id)
);

-- ── Row Level Security ────────────────────────────────────────────────────
-- Prototype stance: everyone reads everything; only owners mutate.
-- Tighten (e.g. moderation roles) before real users arrive.
alter table profiles enable row level security;
alter table apps enable row level security;
alter table app_votes enable row level security;
alter table comments enable row level security;
alter table comment_likes enable row level security;
alter table milestones enable row level security;
alter table milestone_cheers enable row level security;

-- Public read for all content tables.
create policy "public read profiles" on profiles for select using (true);
create policy "public read apps" on apps for select using (true);
create policy "public read app_votes" on app_votes for select using (true);
create policy "public read comments" on comments for select using (true);
create policy "public read comment_likes" on comment_likes for select using (true);
create policy "public read milestones" on milestones for select using (true);
create policy "public read milestone_cheers" on milestone_cheers for select using (true);

-- Owners manage their own rows. auth.uid() must equal the row's owner id,
-- so Google/mock ids must be reconciled with auth.users at cutover.
create policy "owners manage profiles" on profiles
  for all using (auth.uid()::text = id) with check (auth.uid()::text = id);
create policy "owners manage apps" on apps
  for all using (auth.uid()::text = creator_id) with check (auth.uid()::text = creator_id);

-- Any signed-in user may vote/like/cheer/comment; removal of one's own row only.
create policy "signed-in insert app_votes" on app_votes
  for insert with check (auth.role() = 'authenticated');
create policy "own delete app_votes" on app_votes
  for delete using (auth.uid()::text = user_id);
create policy "signed-in insert comments" on comments
  for insert with check (auth.role() = 'authenticated');
create policy "signed-in insert comment_likes" on comment_likes
  for insert with check (auth.role() = 'authenticated');
create policy "own delete comment_likes" on comment_likes
  for delete using (auth.uid()::text = user_id);
create policy "signed-in insert milestones" on milestones
  for insert with check (auth.role() = 'authenticated');
create policy "signed-in insert milestone_cheers" on milestone_cheers
  for insert with check (auth.role() = 'authenticated');
create policy "own delete milestone_cheers" on milestone_cheers
  for delete using (auth.uid()::text = user_id);

-- ── Helpful indexes ───────────────────────────────────────────────────────
create index if not exists apps_creator_idx on apps (creator_id);
create index if not exists comments_app_idx on comments (app_id, created_at);
create index if not exists comments_parent_idx on comments (parent_id);
create index if not exists milestones_created_idx on milestones (created_at desc);
