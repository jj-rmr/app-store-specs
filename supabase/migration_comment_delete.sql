-- Author-owned comment/reply deletes for databases created before this policy.
-- Fresh installs get it from schema.sql. Replies cascade via the parent_id
-- foreign key; comment_likes cascade via their foreign key. Run in the
-- Supabase SQL editor.

drop policy if exists "own delete comments" on comments;

create policy "own delete comments" on comments
  for delete using (auth.uid()::text = author_id);
