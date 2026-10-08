-- Counter toggles + project delete as SECURITY DEFINER functions.
-- Why: RLS has no UPDATE policy on the counter columns (deliberately — direct
-- row edits stay forbidden), so the app must mutate counters through these
-- RPCs. Each function verifies caller's identity itself and touches only the
-- counter + its membership row. Run in the Supabase SQL editor.

-- ── Toggle a project upvote ───────────────────────────────────────────────
create or replace function toggle_app_vote(p_app_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid text := auth.uid()::text;
  v_row apps%rowtype;
  v_liked boolean;
begin
  if v_uid is null then
    raise exception 'Sign in to vote.';
  end if;
  if exists (select 1 from app_votes where app_id = p_app_id and user_id = v_uid) then
    delete from app_votes where app_id = p_app_id and user_id = v_uid;
    update apps set votes = greatest(0, votes - 1) where id = p_app_id returning * into v_row;
    v_liked := false;
  else
    insert into app_votes (app_id, user_id) values (p_app_id, v_uid);
    update apps set votes = votes + 1 where id = p_app_id returning * into v_row;
    v_liked := true;
  end if;
  if v_row.id is null then
    raise exception 'Project not found.';
  end if;
  return jsonb_build_object('row', to_jsonb(v_row), 'liked', v_liked);
end;
$$;

-- ── Toggle a comment like ─────────────────────────────────────────────────
create or replace function toggle_comment_like(p_comment_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid text := auth.uid()::text;
  v_row comments%rowtype;
  v_liked boolean;
begin
  if v_uid is null then
    raise exception 'Sign in to like.';
  end if;
  if exists (select 1 from comment_likes where comment_id = p_comment_id and user_id = v_uid) then
    delete from comment_likes where comment_id = p_comment_id and user_id = v_uid;
    update comments set likes = greatest(0, likes - 1) where id = p_comment_id returning * into v_row;
    v_liked := false;
  else
    insert into comment_likes (comment_id, user_id) values (p_comment_id, v_uid);
    update comments set likes = likes + 1 where id = p_comment_id returning * into v_row;
    v_liked := true;
  end if;
  if v_row.id is null then
    raise exception 'Comment not found.';
  end if;
  return jsonb_build_object('row', to_jsonb(v_row), 'liked', v_liked);
end;
$$;

-- ── Toggle a milestone cheer ──────────────────────────────────────────────
create or replace function toggle_milestone_cheer(p_milestone_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid text := auth.uid()::text;
  v_row milestones%rowtype;
  v_liked boolean;
begin
  if v_uid is null then
    raise exception 'Sign in to cheer.';
  end if;
  if exists (select 1 from milestone_cheers where milestone_id = p_milestone_id and user_id = v_uid) then
    delete from milestone_cheers where milestone_id = p_milestone_id and user_id = v_uid;
    update milestones set cheers = greatest(0, cheers - 1) where id = p_milestone_id returning * into v_row;
    v_liked := false;
  else
    insert into milestone_cheers (milestone_id, user_id) values (p_milestone_id, v_uid);
    update milestones set cheers = cheers + 1 where id = p_milestone_id returning * into v_row;
    v_liked := true;
  end if;
  if v_row.id is null then
    raise exception 'Update not found.';
  end if;
  return jsonb_build_object('row', to_jsonb(v_row), 'liked', v_liked);
end;
$$;

-- ── Delete a project with its threads ─────────────────────────────────────
-- Comments carry no FK (wall threads share the table), so they are cleaned
-- explicitly. Votes cascade. Only the owner may call it.
create or replace function delete_project(p_app_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid text := auth.uid()::text;
  v_creator text;
begin
  if v_uid is null then
    raise exception 'Sign in to delete.';
  end if;
  select creator_id into v_creator from apps where id = p_app_id;
  if not found then
    raise exception 'Project not found.';
  end if;
  if v_creator is distinct from v_uid then
    raise exception 'You can only delete your own projects.';
  end if;
  delete from comments where app_id = p_app_id;
  delete from apps where id = p_app_id;
end;
$$;

grant execute on function toggle_app_vote(text) to authenticated;
grant execute on function toggle_comment_like(text) to authenticated;
grant execute on function toggle_milestone_cheer(text) to authenticated;
grant execute on function delete_project(text) to authenticated;
