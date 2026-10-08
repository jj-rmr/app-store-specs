// HTTP implementations of the repo contracts. Inactive until
// VITE_DATA_SOURCE=http AND VITE_API_URL are set — see BACKEND_READINESS.md
// for the endpoint contract the server must honor. Local behavior is untouched.

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
import type { AppInput, AppUpdate, ListAppsParams, User } from "../types";
import { api, setApiToken } from "./api";
import {
  toApp,
  toComment,
  toMilestone,
  toProfile,
  toUser,
  type AppRow,
  type CommentRow,
  type MilestoneRow,
  type ProfileRow,
} from "./rows";

function toQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export function createHttpAuthRepo(): AuthRepo {
  return {
    async getSession(): Promise<User | null> {
      try {
        const { user } = await api<{ user: { id: string; email: string; name: string } }>(
          "/auth/session",
        );
        return toUser(user);
      } catch {
        return null;
      }
    },

    async signin(email: string, password: string): Promise<User> {
      try {
        const { user, token } = await api<{
          user: { id: string; email: string; name: string };
          token: string;
        }>("/auth/signin", { method: "POST", body: JSON.stringify({ email, password }) });
        setApiToken(token);
        return toUser(user);
      } catch {
        throw new AuthError();
      }
    },

    async signup(name: string, email: string, password: string): Promise<User> {
      const { user, token } = await api<{
        user: { id: string; email: string; name: string };
        token: string;
      }>("/auth/signup", { method: "POST", body: JSON.stringify({ name, email, password }) });
      setApiToken(token);
      return toUser(user);
    },

    // The server MUST verify the Google access token with Google (userinfo)
    // and match verified email -> account itself. Never trust bare claims.
    async signinWithGoogleAccount(account: GoogleAccount): Promise<GoogleSignInResult> {
      try {
        const { user, token, picture } = await api<{
          user: { id: string; email: string; name: string };
          token: string;
          picture?: string;
        }>("/auth/google", {
          method: "POST",
          body: JSON.stringify({ accessToken: account.accessToken ?? null }),
        });
        setApiToken(token);
        return { user: toUser(user), picture };
      } catch (e) {
        throw new AuthError(e instanceof Error ? e.message : "Google sign-in failed.");
      }
    },

    async signout(): Promise<void> {
      try {
        await api("/auth/signout", { method: "POST" });
      } finally {
        setApiToken(null);
      }
    },

    async updateName(name: string): Promise<User> {
      const { user } = await api<{ user: { id: string; email: string; name: string } }>(
        "/auth/name",
        { method: "PATCH", body: JSON.stringify({ name }) },
      );
      return toUser(user);
    },
  };
}

export function createHttpAppRepo(): AppRepo {
  return {
    async listApps(params: ListAppsParams = {}) {
      const { apps } = await api<{ apps: AppRow[] }>(
        `/apps${toQuery({
          query: params.query,
          category: params.category,
          limit: params.limit,
          offset: params.offset,
        })}`,
      );
      return apps.map((row) => toApp(row));
    },

    async getApp(id: string) {
      try {
        const { app } = await api<{ app: AppRow }>(`/apps/${encodeURIComponent(id)}`);
        return toApp(app);
      } catch (e) {
        if (e instanceof Error && e.message.includes("404"))
          throw new NotFoundError("Project not found.");
        throw e;
      }
    },

    async createApp(input: AppInput, _author: User) {
      const { app } = await api<{ app: AppRow }>("/apps", {
        method: "POST",
        body: JSON.stringify({
          title: input.title,
          description: input.description,
          url: input.url,
          repo_url: input.repoUrl,
          category: input.category,
          screenshots: input.screenshots,
          docs: input.docs,
          collaborators: input.collaborators,
        }),
      });
      return toApp(app);
    },

    async updateApp(appId: string, _author: User, patch: AppUpdate) {
      const { app } = await api<{ app: AppRow }>(`/apps/${encodeURIComponent(appId)}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: patch.title,
          description: patch.description,
          url: patch.url,
          repo_url: patch.repoUrl,
          category: patch.category,
          screenshots: patch.screenshots,
          docs: patch.docs,
          collaborators: patch.collaborators,
        }),
      });
      return toApp(app);
    },

    async deleteApp(appId: string, _author: User): Promise<void> {
      await api(`/apps/${encodeURIComponent(appId)}`, { method: "DELETE" });
    },

    async toggleVote(appId: string, _userId: string) {
      const { app } = await api<{ app: AppRow }>(`/apps/${encodeURIComponent(appId)}/vote`, {
        method: "POST",
      });
      return toApp(app);
    },

    async listVoters(appId: string) {
      const { voters } = await api<{ voters: ProfileRow[] }>(
        `/apps/${encodeURIComponent(appId)}/voters`,
      );
      return voters.map(toProfile).sort((a, b) => a.name.localeCompare(b.name));
    },

    async listBuilders() {
      // Served from /profiles on the server; builders are derived client-side.
      const { profiles } = await api<{ profiles: ProfileRow[] }>("/profiles");
      const seen = new Map(profiles.map((p) => [p.name, p]));
      return [...seen.values()].map((p) => ({
        name: p.name,
        role: p.role,
        apps: 0,
        color: p.color,
      }));
    },

    async listComments(appId: string) {
      const { comments } = await api<{ comments: CommentRow[] }>(
        `/apps/${encodeURIComponent(appId)}/comments`,
      );
      return comments.map(toComment);
    },

    async addComment(appId: string, _author: User, body: string, parentId?: string) {
      const { comment } = await api<{ comment: CommentRow }>(
        `/apps/${encodeURIComponent(appId)}/comments`,
        { method: "POST", body: JSON.stringify({ body, parentId }) },
      );
      return toComment(comment);
    },

    async deleteComment(appId: string, commentId: string, _author: User): Promise<void> {
      await api(`/apps/${encodeURIComponent(appId)}/comments/${encodeURIComponent(commentId)}`, {
        method: "DELETE",
      });
    },

    async toggleCommentLike(appId: string, commentId: string, _userId: string) {
      const { comment } = await api<{ comment: CommentRow }>(
        `/apps/${encodeURIComponent(appId)}/comments/${encodeURIComponent(commentId)}/like`,
        { method: "POST" },
      );
      return toComment(comment);
    },

    async listMilestones() {
      const { milestones } = await api<{ milestones: MilestoneRow[] }>("/milestones");
      return milestones.map(toMilestone);
    },

    async postMilestone(_author: User, body: string, appId?: string) {
      const { milestone } = await api<{ milestone: MilestoneRow }>("/milestones", {
        method: "POST",
        body: JSON.stringify({ body, appId }),
      });
      return toMilestone(milestone);
    },

    async toggleMilestoneCheer(milestoneId: string, _userId: string) {
      const { milestone } = await api<{ milestone: MilestoneRow }>(
        `/milestones/${encodeURIComponent(milestoneId)}/cheer`,
        { method: "POST" },
      );
      return toMilestone(milestone);
    },
  };
}

export function createHttpProfileRepo(): ProfileRepo {
  return {
    async listProfiles() {
      const { profiles } = await api<{ profiles: ProfileRow[] }>("/profiles");
      return profiles.map(toProfile);
    },

    async getProfile(id: string) {
      try {
        const { profile } = await api<{ profile: ProfileRow }>(
          `/profiles/${encodeURIComponent(id)}`,
        );
        return toProfile(profile);
      } catch (e) {
        if (e instanceof Error && e.message.includes("404"))
          throw new NotFoundError("Developer not found.");
        throw e;
      }
    },

    async getProfileByName(name: string) {
      try {
        const { profile } = await api<{ profile: ProfileRow }>(
          `/profiles/by-name/${encodeURIComponent(name)}`,
        );
        return toProfile(profile);
      } catch (e) {
        if (e instanceof Error && e.message.includes("404")) return null;
        throw e;
      }
    },

    async ensureUserProfile(user: User) {
      const { profile } = await api<{ profile: ProfileRow }>("/profiles/ensure", {
        method: "POST",
        body: JSON.stringify({ id: user.id, email: user.email, name: user.name }),
      });
      return toProfile(profile);
    },

    async updateProfile(id: string, patch: ProfilePatch, _requesterId: string) {
      const { profile } = await api<{ profile: ProfileRow }>(
        `/profiles/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            role: patch.role,
            bio: patch.bio,
            color: patch.color,
            image_url: patch.imageUrl,
            name: patch.name,
            theme: patch.theme !== undefined ? patch.theme.trim() || null : undefined,
            palette: patch.palette !== undefined ? patch.palette.trim() || null : undefined,
          }),
        },
      );
      return toProfile(profile);
    },

    async claimProfile(duplicateProfileId: string, _requester: User) {
      const { profile } = await api<{ profile: ProfileRow }>("/profiles/claim", {
        method: "POST",
        body: JSON.stringify({ duplicateProfileId }),
      });
      return toProfile(profile);
    },
  };
}
