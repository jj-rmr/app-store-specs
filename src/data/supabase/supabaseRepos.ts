// Supabase implementations of the repo contracts. Active only when
// VITE_DATA_SOURCE=supabase. Reads work with the anon key under the public
// RLS policies; writes require a Supabase Auth session (Google provider).
// Localhost default behavior is untouched.

import {
  AuthError,
  NotFoundError,
  type AppRepo,
  type AuthRepo,
  type GoogleAccount,
  type GoogleSignInResult,
  type ProfilePatch,
  type ProfileRepo,
} from "../repositories";
import {
  PROFILE_THEMES,
  SITE_PALETTE_IDS,
  type AppInput,
  type AppUpdate,
  type ListAppsParams,
  type User,
} from "../types";
import { getSupabase } from "./client";
import {
  toApp,
  toComment,
  toMilestone,
  toProfile,
  type AppRow,
  type CommentRow,
  type MilestoneRow,
} from "../http/rows";

const COLORS = ["yellow", "mint", "pink", "sky", "lavender"] as const;

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function isMissing(result: { error: { code?: string } | null }): boolean {
  return result.error?.code === "PGRST116";
}

async function authUid(): Promise<string | null> {
  const { data } = await getSupabase().auth.getUser();
  return data.user?.id ?? null;
}

function sessionUser(id: string, email: string | undefined, name: unknown): User {
  const cleanEmail = email ?? "";
  const display = (typeof name === "string" && name.trim()) || cleanEmail.split("@")[0] || "Member";
  return { id, email: cleanEmail, name: display.slice(0, 40) };
}

// ── Auth ────────────────────────────────────────────────────────────────────

export function createSupabaseAuthRepo(): AuthRepo {
  return {
    async getSession(): Promise<User | null> {
      const { data } = await getSupabase().auth.getSession();
      const user = data.session?.user;
      if (!user) return null;
      return sessionUser(user.id, user.email, user.user_metadata?.["name"]);
    },

    async signin(email: string, password: string): Promise<User> {
      const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
      if (error || !data.user) throw new AuthError();
      return sessionUser(data.user.id, data.user.email, data.user.user_metadata?.["name"]);
    },

    async signup(name: string, email: string, password: string): Promise<User> {
      const cleanName = name.trim().slice(0, 40);
      if (!cleanName) throw new Error("Name is required.");
      const { data, error } = await getSupabase().auth.signUp({
        email: email.trim(),
        password,
        options: { data: { name: cleanName } },
      });
      if (error) throw new Error(error.message);
      // Email confirmation on: account exists but no session yet.
      if (!data.session || !data.user) {
        throw new AuthError("Account created — check your email to confirm, then sign in.");
      }
      return sessionUser(data.user.id, data.user.email, cleanName);
    },

    // Google uses the OAuth redirect flow in Supabase mode (see Login).
    // This method only runs if something calls it directly.
    async signinWithGoogleAccount(_account: GoogleAccount): Promise<GoogleSignInResult> {
      await getSupabase().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/store` },
      });
      throw new AuthError("Redirecting to Google — continue there.");
    },

    async signout(): Promise<void> {
      await getSupabase().auth.signOut();
    },

    async updateName(name: string): Promise<User> {
      const clean = name.trim();
      if (!clean) throw new Error("Name is required.");
      if (clean.length > 40) throw new Error("Keep your name under 40 characters.");
      const supabase = getSupabase();
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) throw new Error("You are not signed in.");
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ name: clean })
        .eq("id", user.id);
      if (profileError) throw new Error(profileError.message);
      // Fail loudly here: a silent metadata failure used to report success
      // while leaving stale auth metadata behind, which then clobbered the
      // renamed profile row on the next login (see ensureUserProfile).
      const { error: metaError } = await supabase.auth.updateUser({
        data: { name: clean },
      });
      if (metaError) throw new Error(metaError.message);
      return sessionUser(user.id, user.email, clean);
    },
  };
}

// ── Apps / comments / milestones ────────────────────────────────────────────

type VoteMap = Map<string, boolean>;

async function viewerVotes(appIds: string[], userId: string | null): Promise<VoteMap> {
  const map: VoteMap = new Map();
  if (!userId || appIds.length === 0) return map;
  const { data } = await getSupabase()
    .from("app_votes")
    .select("app_id")
    .eq("user_id", userId)
    .in("app_id", appIds);
  for (const row of (data ?? []) as { app_id: string }[]) map.set(row.app_id, true);
  return map;
}

async function commentCounts(appIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (appIds.length === 0) return counts;
  const { data } = await getSupabase().from("comments").select("app_id").in("app_id", appIds);
  for (const row of (data ?? []) as { app_id: string }[]) {
    counts.set(row.app_id, (counts.get(row.app_id) ?? 0) + 1);
  }
  return counts;
}

function toAppRow(row: Record<string, unknown>): AppRow {
  return {
    id: String(row["id"]),
    title: String(row["title"] ?? ""),
    description: String(row["description"] ?? ""),
    creator: String(row["creator"] ?? ""),
    creator_id: (row["creator_id"] as string | null) ?? null,
    category: row["category"] as AppRow["category"],
    votes: Number(row["votes"] ?? 0),
    color: String(row["color"] ?? "sky"),
    url: (row["url"] as string | null) ?? null,
    repo_url: (row["repo_url"] as string | null) ?? null,
    screenshots: (row["screenshots"] as string[] | null) ?? [],
    docs: (row["docs"] as string | null) ?? null,
    collaborators: (row["collaborators"] as string[] | null) ?? [],
    created_at: String(row["created_at"] ?? new Date().toISOString()),
  };
}

function toCommentRow(row: Record<string, unknown>): CommentRow {
  return {
    id: String(row["id"]),
    app_id: String(row["app_id"] ?? ""),
    author_id: String(row["author_id"] ?? ""),
    author_name: String(row["author_name"] ?? ""),
    body: String(row["body"] ?? ""),
    parent_id: (row["parent_id"] as string | null) ?? null,
    likes: Number(row["likes"] ?? 0),
    created_at: String(row["created_at"] ?? new Date().toISOString()),
  };
}

function toMilestoneRow(row: Record<string, unknown>): MilestoneRow {
  return {
    id: String(row["id"]),
    author_id: String(row["author_id"] ?? ""),
    author_name: String(row["author_name"] ?? ""),
    body: String(row["body"] ?? ""),
    app_id: (row["app_id"] as string | null) ?? null,
    cheers: Number(row["cheers"] ?? 0),
    created_at: String(row["created_at"] ?? new Date().toISOString()),
  };
}

export function createSupabaseAppRepo(): AppRepo {
  return {
    async listApps(params: ListAppsParams = {}) {
      const { query = "", category = "All", limit = 100, offset = 0, userId } = params;
      const supabase = getSupabase();
      let request = supabase.from("apps").select("*").order("created_at", { ascending: false });
      const q = query.trim();
      if (q) {
        const like = `%${q.replace(/[%_]/g, "")}%`;
        request = request.or(`title.ilike.${like},description.ilike.${like},creator.ilike.${like}`);
      }
      if (category !== "All") request = request.eq("category", category);
      request = request.range(offset, offset + limit - 1);
      const { data, error } = await request;
      if (error) throw new Error(error.message);
      const rows = (data ?? []).map(toAppRow);
      const ids = rows.map((r) => r.id);
      const uid = (await authUid()) ?? userId ?? null;
      const [votes, counts] = await Promise.all([viewerVotes(ids, uid), commentCounts(ids)]);
      return rows.map((row) =>
        toApp({ ...row, viewer_has_voted: votes.get(row.id) }, counts.get(row.id) ?? 0),
      );
    },

    async getApp(id: string, userId?: string) {
      const supabase = getSupabase();
      const { data, error } = await supabase.from("apps").select("*").eq("id", id).single();
      if (error || !data) throw new NotFoundError("Project not found.");
      const row = toAppRow(data as Record<string, unknown>);
      const uid = (await authUid()) ?? userId ?? null;
      const [votes, counts] = await Promise.all([
        viewerVotes([row.id], uid),
        commentCounts([row.id]),
      ]);
      return toApp({ ...row, viewer_has_voted: votes.get(row.id) }, counts.get(row.id) ?? 0);
    },

    async createApp(input: AppInput, author: User) {
      const title = input.title.trim();
      const description = input.description.trim();
      if (!title || !description) throw new Error("Title and description are required.");
      if (title.length > 80) throw new Error("Keep the project name under 80 characters.");
      if (description.length > 280) throw new Error("Keep the description under 280 characters.");
      const url = input.url?.trim();
      const repoUrl = input.repoUrl?.trim();
      if (url && !/^https?:\/\//i.test(url))
        throw new Error("App link must start with http(s)://.");
      if (repoUrl && !/^https?:\/\//i.test(repoUrl))
        throw new Error("Repo link must start with http(s)://.");
      const docs = input.docs?.trim();
      if (docs && docs.length > 50000)
        throw new Error("Keep documentation under 50000 characters.");
      const screenshots = (input.screenshots ?? []).filter(Boolean).slice(0, 3);
      for (const src of screenshots) {
        if (src.length > 500_000) throw new Error("Images are too large. Pick smaller files.");
      }
      const uid = (await authUid()) ?? author.id;
      const { data, error } = await getSupabase()
        .from("apps")
        .insert({
          id: newId(),
          title,
          description,
          creator: author.name,
          creator_id: uid,
          category: input.category,
          votes: 0,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          url: url || null,
          repo_url: repoUrl || null,
          screenshots,
          docs: docs || null,
          collaborators: (input.collaborators ?? []).filter(Boolean).slice(0, 10),
        })
        .select()
        .single();
      if (error || !data) throw new Error(error?.message ?? "Could not publish project.");
      return toApp(toAppRow(data as Record<string, unknown>), 0);
    },

    async updateApp(appId: string, author: User, patch: AppUpdate) {
      const supabase = getSupabase();
      const { data: existing, error: fetchError } = await supabase
        .from("apps")
        .select("*")
        .eq("id", appId)
        .single();
      if (fetchError || !existing) throw new NotFoundError("Project not found.");
      const current = toAppRow(existing as Record<string, unknown>);
      const owned = current.creator_id
        ? current.creator_id === author.id
        : current.creator.toLowerCase() === author.name.toLowerCase();
      if (!owned) throw new Error("You can only edit your own projects.");
      const title = patch.title !== undefined ? patch.title.trim() : current.title;
      const description =
        patch.description !== undefined ? patch.description.trim() : current.description;
      const url = patch.url !== undefined ? patch.url.trim() : (current.url ?? "");
      const repoUrl = patch.repoUrl !== undefined ? patch.repoUrl.trim() : (current.repo_url ?? "");
      const docs = patch.docs !== undefined ? patch.docs.trim() : (current.docs ?? "");
      if (!title) throw new Error("Title is required.");
      if (!description) throw new Error("Description is required.");
      if (title.length > 80) throw new Error("Keep the project name under 80 characters.");
      if (description.length > 280) throw new Error("Keep the description under 280 characters.");
      if (docs.length > 50000) throw new Error("Keep documentation under 50000 characters.");
      if (url && !/^https?:\/\//i.test(url))
        throw new Error("App link must start with http(s)://.");
      if (repoUrl && !/^https?:\/\//i.test(repoUrl))
        throw new Error("Repo link must start with http(s)://.");
      const screenshots =
        patch.screenshots !== undefined
          ? patch.screenshots.filter(Boolean).slice(0, 3)
          : current.screenshots;
      for (const src of screenshots) {
        if (src.length > 500_000) throw new Error("Images are too large. Pick smaller files.");
      }
      const collaborators =
        patch.collaborators !== undefined
          ? patch.collaborators.filter(Boolean).slice(0, 10)
          : current.collaborators;
      const { data, error } = await supabase
        .from("apps")
        .update({
          title,
          description,
          url: url || null,
          repo_url: repoUrl || null,
          category: patch.category ?? current.category,
          screenshots,
          docs: docs || null,
          collaborators,
        })
        .eq("id", appId)
        .select()
        .single();
      if (error || !data) throw new Error(error?.message ?? "Could not save changes.");
      return this.getApp(appId, author.id);
    },

    async deleteApp(appId: string, author: User): Promise<void> {
      const supabase = getSupabase();
      const { data: existing, error: fetchError } = await supabase
        .from("apps")
        .select("creator,creator_id")
        .eq("id", appId)
        .single();
      if (fetchError || !existing) throw new NotFoundError("Project not found.");
      const row = existing as { creator: string; creator_id: string | null };
      const owned = row.creator_id
        ? row.creator_id === author.id
        : row.creator.toLowerCase() === author.name.toLowerCase();
      if (!owned) throw new Error("You can only delete your own projects.");
      // Counter/row cleanup runs inside the function (RLS forbids direct edits).
      const { error } = await supabase.rpc("delete_project", { p_app_id: appId });
      if (error) throw new Error(error.message);
    },

    async toggleVote(appId: string, userId: string) {
      const { data, error } = await getSupabase().rpc("toggle_app_vote", { p_app_id: appId });
      if (error) throw new Error(error.message);
      const payload = data as { row: Record<string, unknown>; liked: boolean };
      if (!payload?.row) throw new NotFoundError("Project not found.");
      const app = toApp(toAppRow(payload.row));
      const refreshed = await this.getApp(appId, userId);
      return { ...app, comments: refreshed.comments, viewerHasVoted: Boolean(payload.liked) };
    },

    async listVoters(appId: string) {
      const supabase = getSupabase();
      const { data: votes, error: votesError } = await supabase
        .from("app_votes")
        .select("user_id")
        .eq("app_id", appId);
      if (votesError) throw new Error(votesError.message);
      const ids = [...new Set(((votes ?? []) as { user_id: string }[]).map((v) => v.user_id))];
      if (ids.length === 0) return [];
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .in("id", ids);
      if (profilesError) throw new Error(profilesError.message);
      return ((profiles ?? []) as Record<string, unknown>[])
        .map((r) =>
          toProfile({
            id: String(r["id"]),
            name: String(r["name"] ?? ""),
            role: String(r["role"] ?? ""),
            bio: String(r["bio"] ?? ""),
            color: String(r["color"] ?? "sky"),
            image_url: (r["image_url"] as string | null) ?? null,
            theme: (r["theme"] as string | null) ?? null,
            palette: (r["palette"] as string | null) ?? null,
            created_at: String(r["created_at"] ?? new Date().toISOString()),
          }),
        )
        .sort((a, b) => a.name.localeCompare(b.name));
    },

    async listBuilders() {
      const { data, error } = await getSupabase().from("profiles").select("name,role,color");
      if (error) throw new Error(error.message);
      return ((data ?? []) as { name: string; role: string; color: string }[]).map((p) => ({
        name: p.name,
        role: p.role,
        apps: 0,
        color: p.color,
      }));
    },

    async listComments(appId: string, userId?: string) {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("comments")
        .select("*")
        .eq("app_id", appId)
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      const rows = (data ?? []).map((r) => toComment(toCommentRow(r as Record<string, unknown>)));
      const uid = (await authUid()) ?? userId ?? null;
      let liked = new Set<string>();
      if (uid && rows.length > 0) {
        const { data: likes } = await supabase
          .from("comment_likes")
          .select("comment_id")
          .eq("user_id", uid)
          .in(
            "comment_id",
            rows.map((r) => r.id),
          );
        liked = new Set(((likes ?? []) as { comment_id: string }[]).map((l) => l.comment_id));
      }
      return rows.map((r) => ({ ...r, viewerHasLiked: liked.has(r.id) }));
    },

    async addComment(appId: string, author: User, body: string, parentId?: string) {
      const text = body.trim();
      if (!text) throw new Error("Comment cannot be empty.");
      if (text.length > 500) throw new Error("Keep comments under 500 characters.");
      const supabase = getSupabase();
      if (parentId) {
        const { data: parent, error } = await supabase
          .from("comments")
          .select("id,app_id")
          .eq("id", parentId)
          .single();
        if (error || !parent) throw new Error("That comment no longer exists.");
        if ((parent as { app_id: string }).app_id !== appId) {
          throw new Error("That comment belongs to another thread.");
        }
      }
      const { data, error } = await supabase
        .from("comments")
        .insert({
          id: newId(),
          app_id: appId,
          author_id: author.id,
          author_name: author.name,
          body: text,
          parent_id: parentId ?? null,
          likes: 0,
        })
        .select()
        .single();
      if (error || !data) throw new Error(error?.message ?? "Could not post comment.");
      return { ...toComment(toCommentRow(data as Record<string, unknown>)), viewerHasLiked: false };
    },

    async deleteComment(appId: string, commentId: string, author: User): Promise<void> {
      const supabase = getSupabase();
      const { data: existing, error: fetchError } = await supabase
        .from("comments")
        .select("id,app_id,author_id")
        .eq("id", commentId)
        .single();
      if (fetchError || !existing) throw new NotFoundError("Comment not found.");
      const row = existing as { app_id: string; author_id: string };
      if (row.app_id !== appId) throw new Error("That comment belongs to another thread.");
      if (row.author_id !== author.id) throw new Error("You can only delete your own comments.");
      // Replies cascade via the parent_id FK; the RLS policy ("own delete
      // comments", see schema.sql) enforces authorship server-side too.
      const { error } = await supabase.from("comments").delete().eq("id", commentId);
      if (error) throw new Error(error.message);
    },

    async toggleCommentLike(_appId: string, commentId: string, _userId: string) {
      const { data, error } = await getSupabase().rpc("toggle_comment_like", {
        p_comment_id: commentId,
      });
      if (error) throw new Error(error.message);
      const payload = data as { row: Record<string, unknown>; liked: boolean };
      if (!payload?.row) throw new NotFoundError("Comment not found.");
      return { ...toComment(toCommentRow(payload.row)), viewerHasLiked: payload.liked };
    },

    async listMilestones(userId?: string) {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("milestones")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      const rows = (data ?? []).map((r) =>
        toMilestone(toMilestoneRow(r as Record<string, unknown>)),
      );
      const uid = (await authUid()) ?? userId ?? null;
      let cheered = new Set<string>();
      if (uid && rows.length > 0) {
        const { data: cheers } = await supabase
          .from("milestone_cheers")
          .select("milestone_id")
          .eq("user_id", uid)
          .in(
            "milestone_id",
            rows.map((r) => r.id),
          );
        cheered = new Set(
          ((cheers ?? []) as { milestone_id: string }[]).map((c) => c.milestone_id),
        );
      }
      return rows.map((r) => ({ ...r, viewerHasCheered: cheered.has(r.id) }));
    },

    async postMilestone(author: User, body: string, appId?: string) {
      const text = body.trim();
      if (!text) throw new Error("Update cannot be empty.");
      if (text.length > 280) throw new Error("Keep updates under 280 characters.");
      if (appId) {
        const { data: target, error } = await getSupabase()
          .from("apps")
          .select("creator,creator_id")
          .eq("id", appId)
          .single();
        if (error || !target) throw new NotFoundError("Project not found.");
        const row = target as { creator: string; creator_id: string | null };
        const owned = row.creator_id
          ? row.creator_id === author.id
          : row.creator.toLowerCase() === author.name.toLowerCase();
        if (!owned) throw new Error("You can only link your own projects.");
      }
      const { data, error } = await getSupabase()
        .from("milestones")
        .insert({
          id: newId(),
          author_id: author.id,
          author_name: author.name,
          body: text,
          app_id: appId ?? null,
          cheers: 0,
        })
        .select()
        .single();
      if (error || !data) throw new Error(error?.message ?? "Could not post update.");
      return {
        ...toMilestone(toMilestoneRow(data as Record<string, unknown>)),
        viewerHasCheered: false,
      };
    },

    async toggleMilestoneCheer(milestoneId: string, _userId: string) {
      const { data, error } = await getSupabase().rpc("toggle_milestone_cheer", {
        p_milestone_id: milestoneId,
      });
      if (error) throw new Error(error.message);
      const payload = data as { row: Record<string, unknown>; liked: boolean };
      if (!payload?.row) throw new NotFoundError("Update not found.");
      return { ...toMilestone(toMilestoneRow(payload.row)), viewerHasCheered: payload.liked };
    },
  };
}

export function createSupabaseProfileRepo(): ProfileRepo {
  return {
    async listProfiles() {
      const { data, error } = await getSupabase().from("profiles").select("*").order("name");
      if (error) throw new Error(error.message);
      return ((data ?? []) as Record<string, unknown>[]).map((r) =>
        toProfile({
          id: String(r["id"]),
          name: String(r["name"] ?? ""),
          role: String(r["role"] ?? ""),
          bio: String(r["bio"] ?? ""),
          color: String(r["color"] ?? "sky"),
          image_url: (r["image_url"] as string | null) ?? null,
          theme: (r["theme"] as string | null) ?? null,
          palette: (r["palette"] as string | null) ?? null,
          created_at: String(r["created_at"] ?? new Date().toISOString()),
        }),
      );
    },

    async getProfile(id: string) {
      const supabase = getSupabase();
      const exact = await supabase.from("profiles").select("*").eq("id", id).single();
      let row = !exact.error && exact.data ? (exact.data as Record<string, unknown>) : null;
      if (!row) {
        const fallback = await supabase.from("profiles").select("*").ilike("id", id).single();
        if (fallback.error || !fallback.data) throw new NotFoundError("Developer not found.");
        row = fallback.data as Record<string, unknown>;
      }
      return toProfile({
        id: String(row["id"]),
        name: String(row["name"] ?? ""),
        role: String(row["role"] ?? ""),
        bio: String(row["bio"] ?? ""),
        color: String(row["color"] ?? "sky"),
        image_url: (row["image_url"] as string | null) ?? null,
        theme: (row["theme"] as string | null) ?? null,
        palette: (row["palette"] as string | null) ?? null,
        created_at: String(row["created_at"] ?? new Date().toISOString()),
      });
    },

    async getProfileByName(name: string) {
      const clean = name.trim();
      if (!clean) return null;
      const { data, error } = await getSupabase()
        .from("profiles")
        .select("*")
        .ilike("name", clean)
        .limit(1)
        .maybeSingle();
      if (error || !data) return null;
      const row = data as Record<string, unknown>;
      return toProfile({
        id: String(row["id"]),
        name: String(row["name"] ?? ""),
        role: String(row["role"] ?? ""),
        bio: String(row["bio"] ?? ""),
        color: String(row["color"] ?? "sky"),
        image_url: (row["image_url"] as string | null) ?? null,
        theme: (row["theme"] as string | null) ?? null,
        palette: (row["palette"] as string | null) ?? null,
        created_at: String(row["created_at"] ?? new Date().toISOString()),
      });
    },

    async ensureUserProfile(user: User) {
      const supabase = getSupabase();
      const { data: existing } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (existing) {
        const row = existing as Record<string, unknown>;
        const storedName = String(row["name"] ?? "");
        if (storedName !== user.name) {
          if (storedName.trim()) {
            // The profile row is the source of truth for display names (it is
            // what the user edits in-app). Heal the auth metadata toward it.
            // The old direction did the reverse and wiped renames on every
            // login whenever metadata drifted (failed updateUser call or an
            // OAuth provider refresh overwriting user_metadata).
            try {
              await supabase.auth.updateUser({ data: { name: storedName } });
            } catch {
              // Metadata is only a session cache — the row below still wins.
            }
            return this.getProfile(user.id);
          }
          // Data repair for the impossible-but-cheap empty-name row.
          await supabase.from("profiles").update({ name: user.name }).eq("id", user.id);
        }
        return this.getProfile(user.id);
      }
      const { data, error } = await supabase
        .from("profiles")
        .insert({
          id: user.id,
          name: user.name,
          role: "SPECS member",
          bio: "Exploring student-built software across the community.",
          color: "sky",
        })
        .select()
        .single();
      if (error || !data) throw new Error(error?.message ?? "Could not create profile.");
      return this.getProfile(user.id);
    },

    async updateProfile(id: string, patch, requesterId: string) {
      if (id !== requesterId) throw new Error("You can only edit your own profile.");
      const supabase = getSupabase();
      const current = await this.getProfile(id);
      const name = patch.name?.trim() || current.name;
      const role = patch.role?.trim() ?? current.role;
      const bio = patch.bio?.trim() ?? current.bio;
      const color = patch.color?.trim() ?? current.color;
      const imageUrl =
        patch.imageUrl !== undefined ? patch.imageUrl.trim() : (current.imageUrl ?? "");
      const theme =
        patch.theme !== undefined ? patch.theme.trim() || null : (current.theme ?? null);
      if (theme !== null && !(PROFILE_THEMES as readonly string[]).includes(theme)) {
        throw new Error("Pick a valid profile theme.");
      }
      const palette =
        patch.palette !== undefined ? patch.palette.trim() || null : (current.palette ?? null);
      if (palette !== null && !(SITE_PALETTE_IDS as readonly string[]).includes(palette)) {
        throw new Error("Pick a valid website palette.");
      }
      if (!name) throw new Error("Name is required.");
      if (name.length > 40) throw new Error("Keep your name under 40 characters.");
      if (!role) throw new Error("Role is required.");
      if (role.length > 80) throw new Error("Keep role under 80 characters.");
      if (bio.length > 280) throw new Error("Keep bio under 280 characters.");
      const { data: taken } = await supabase
        .from("profiles")
        .select("id")
        .ilike("name", name)
        .neq("id", id)
        .limit(1);
      if (taken && taken.length > 0)
        throw new Error("That name is already taken by another developer.");
      const { error } = await supabase
        .from("profiles")
        .update({ name, role, bio, color, image_url: imageUrl || null, theme, palette })
        .eq("id", id);
      if (error) throw new Error(error.message);
      return this.getProfile(id);
    },

    async claimProfile(duplicateProfileId: string, requester: User) {
      const supabase = getSupabase();
      const duplicate = await this.getProfile(duplicateProfileId);
      if (duplicate.id === requester.id) throw new Error("That is already your profile.");
      if (duplicate.name.trim().toLowerCase() !== requester.name.trim().toLowerCase()) {
        throw new Error("You can only claim a profile with your exact display name.");
      }
      const from = duplicate.id;
      const to = requester.id;

      const { data: ownedApps } = await supabase.from("apps").select("id").eq("creator_id", from);
      for (const app of (ownedApps ?? []) as { id: string }[]) {
        await supabase
          .from("apps")
          .update({ creator_id: to, creator: requester.name })
          .eq("id", app.id);
      }
      const { data: ownedComments } = await supabase
        .from("comments")
        .select("id")
        .eq("author_id", from);
      for (const comment of (ownedComments ?? []) as { id: string }[]) {
        await supabase
          .from("comments")
          .update({ author_id: to, author_name: requester.name })
          .eq("id", comment.id);
      }
      const { data: ownedMilestones } = await supabase
        .from("milestones")
        .select("id")
        .eq("author_id", from);
      for (const milestone of (ownedMilestones ?? []) as { id: string }[]) {
        await supabase
          .from("milestones")
          .update({ author_id: to, author_name: requester.name })
          .eq("id", milestone.id);
      }
      const { data: votes } = await supabase.from("app_votes").select("app_id").eq("user_id", from);
      for (const vote of (votes ?? []) as { app_id: string }[]) {
        await supabase.from("app_votes").delete().eq("app_id", vote.app_id).eq("user_id", from);
        await supabase
          .from("app_votes")
          .upsert({ app_id: vote.app_id, user_id: to }, { onConflict: "app_id,user_id" });
      }
      const { data: likes } = await supabase
        .from("comment_likes")
        .select("comment_id")
        .eq("user_id", from);
      for (const like of (likes ?? []) as { comment_id: string }[]) {
        await supabase
          .from("comment_likes")
          .delete()
          .eq("comment_id", like.comment_id)
          .eq("user_id", from);
        await supabase
          .from("comment_likes")
          .upsert(
            { comment_id: like.comment_id, user_id: to },
            { onConflict: "comment_id,user_id" },
          );
      }
      const { data: cheers } = await supabase
        .from("milestone_cheers")
        .select("milestone_id")
        .eq("user_id", from);
      for (const cheer of (cheers ?? []) as { milestone_id: string }[]) {
        await supabase
          .from("milestone_cheers")
          .delete()
          .eq("milestone_id", cheer.milestone_id)
          .eq("user_id", from);
        await supabase
          .from("milestone_cheers")
          .upsert(
            { milestone_id: cheer.milestone_id, user_id: to },
            { onConflict: "milestone_id,user_id" },
          );
      }
      await supabase.from("profiles").delete().eq("id", from);
      return this.ensureUserProfile(requester);
    },
  };
}
