import { NotFoundError, type AppRepo } from "../repositories";
import type {
  AppInput,
  AppItem,
  AppUpdate,
  Builder,
  Comment,
  ListAppsParams,
  Milestone,
  User,
} from "../types";
import { seedApps, seedBuilders, seedComments, seedMilestones } from "./seed";

const APPS_KEY = "cc.apps.v1";
const VOTES_KEY = "cc.votes.v1";
const COMMENTS_KEY = "cc.comments.v1";
const MILESTONES_KEY = "cc.milestones.v1";

type VotesStore = Record<string, string[]>;
type CommentsStore = Record<string, Comment[]>;

function delay(ms = 120): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function loadApps(): AppItem[] {
  try {
    const raw = localStorage.getItem(APPS_KEY);
    if (!raw) {
      localStorage.setItem(APPS_KEY, JSON.stringify(seedApps));
      return [...seedApps];
    }
    const parsed = JSON.parse(raw) as AppItem[];
    if (!Array.isArray(parsed)) return [...seedApps];
    // Backfill new seed fields (screenshots/docs/creatorId) for existing installs.
    const seedById = new Map(seedApps.map((s) => [s.id, s]));
    let mutated = false;
    const merged = parsed.map((a) => {
      const seed = seedById.get(a.id);
      if (!seed) return a;
      const next = { ...a };
      if (!next.creatorId && seed.creatorId) {
        next.creatorId = seed.creatorId;
        mutated = true;
      }
      if (!next.screenshots && seed.screenshots) {
        next.screenshots = [...seed.screenshots];
        mutated = true;
      }
      if (!next.docs && seed.docs) {
        next.docs = seed.docs;
        mutated = true;
      }
      return next;
    });
    // Add brand-new seed apps without wiping user submissions.
    for (const seed of seedApps) {
      if (!merged.some((a) => a.id === seed.id)) {
        merged.push({ ...seed });
        mutated = true;
      }
    }
    if (mutated) saveApps(merged);
    return merged;
  } catch {
    return [...seedApps];
  }
}

function saveApps(apps: AppItem[]): void {
  localStorage.setItem(APPS_KEY, JSON.stringify(apps));
}

function loadVotes(): VotesStore {
  try {
    const raw = localStorage.getItem(VOTES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as VotesStore;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function saveVotes(votes: VotesStore): void {
  localStorage.setItem(VOTES_KEY, JSON.stringify(votes));
}

function loadComments(): CommentsStore {
  try {
    const raw = localStorage.getItem(COMMENTS_KEY);
    if (!raw) {
      localStorage.setItem(COMMENTS_KEY, JSON.stringify(seedComments));
      return structuredClone(seedComments);
    }
    const parsed = JSON.parse(raw) as CommentsStore;
    if (typeof parsed !== "object" || parsed === null) return structuredClone(seedComments);
    // Merge missing seed threads for existing users (no overwrite of user posts).
    let mutated = false;
    const merged: CommentsStore = { ...parsed };
    for (const [appId, examples] of Object.entries(seedComments)) {
      if (!merged[appId]) {
        merged[appId] = [...examples];
        mutated = true;
      }
    }
    if (mutated) saveComments(merged);
    return merged;
  } catch {
    return structuredClone(seedComments);
  }
}

function saveComments(store: CommentsStore): void {
  localStorage.setItem(COMMENTS_KEY, JSON.stringify(store));
}

function loadMilestones(): Milestone[] {
  try {
    const raw = localStorage.getItem(MILESTONES_KEY);
    if (!raw) {
      localStorage.setItem(MILESTONES_KEY, JSON.stringify(seedMilestones));
      return structuredClone(seedMilestones);
    }
    const parsed = JSON.parse(raw) as Milestone[];
    if (!Array.isArray(parsed)) return structuredClone(seedMilestones);
    return parsed;
  } catch {
    return structuredClone(seedMilestones);
  }
}

function saveMilestones(milestones: Milestone[]): void {
  localStorage.setItem(MILESTONES_KEY, JSON.stringify(milestones));
}

function normalizeMilestone(m: Milestone): Milestone {
  const cheeredBy = Array.isArray(m.cheeredBy) ? m.cheeredBy : [];
  return {
    ...m,
    cheers: typeof m.cheers === "number" ? m.cheers : cheeredBy.length,
    cheeredBy,
  };
}

function normalizeComment(c: Comment): Comment {
  const likedBy = Array.isArray(c.likedBy) ? c.likedBy : [];
  return {
    ...c,
    parentId: c.parentId ?? null,
    likes: typeof c.likes === "number" ? c.likes : likedBy.length,
    likedBy,
  };
}

function withViewer(apps: AppItem[], userId?: string): AppItem[] {
  const votes = loadVotes();
  const comments = loadComments();
  return apps.map((app) => ({
    ...app,
    // Source of truth for counts is the actual thread length, not the stale seed number.
    comments: comments[app.id]?.length ?? app.comments,
    viewerHasVoted: userId ? Boolean(votes[userId]?.includes(app.id)) : false,
  }));
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

const palette = ["yellow", "mint", "pink", "sky", "lavender"] as const;

export function createLocalAppRepo(): AppRepo {
  return {
    async listApps(params: ListAppsParams = {}): Promise<AppItem[]> {
      await delay(100);
      const { query = "", category = "All", limit = 100, offset = 0, userId } = params;
      const all = loadApps();
      const q = query.trim().toLowerCase();
      const filtered = all
        .filter((app) => (category === "All" ? true : app.category === category))
        .filter((app) =>
          q ? `${app.title} ${app.description} ${app.creator}`.toLowerCase().includes(q) : true,
        )
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
      const page = filtered.slice(offset, offset + limit);
      return withViewer(page, userId);
    },

    async getApp(id: string, userId?: string): Promise<AppItem> {
      await delay(80);
      const found = loadApps().find((a) => a.id === id);
      if (!found) throw new NotFoundError("Project not found.");
      return withViewer([found], userId)[0];
    },

    async createApp(input: AppInput, author: User): Promise<AppItem> {
      await delay(150);
      const title = input.title.trim();
      const description = input.description.trim();
      const url = input.url?.trim();
      const repoUrl = input.repoUrl?.trim();
      const docs = input.docs?.trim();
      if (!title || !description) throw new Error("Title and description are required.");
      if (url && !/^https?:\/\//i.test(url)) throw new Error("App link must start with http(s)://.");
      if (repoUrl && !/^https?:\/\//i.test(repoUrl))
        throw new Error("Repo link must start with http(s)://.");
      if (title.length > 80) throw new Error("Keep the project name under 80 characters.");
      if (description.length > 280) throw new Error("Keep the description under 280 characters.");
      if (docs && docs.length > 50000) throw new Error("Keep documentation under 50000 characters.");
      const screenshots = (input.screenshots ?? []).filter(Boolean).slice(0, 3);
      const collaborators = (input.collaborators ?? []).filter(Boolean).slice(0, 10);
      for (const src of screenshots) {
        // ~500KB cap per image keeps the whole local DB inside localStorage quota.
        if (src.length > 500_000) throw new Error("Images are too large. Pick smaller files.");
      }
      const apps = loadApps();
      const item: AppItem = {
        id: newId(),
        title,
        description,
        creator: author.name,
        creatorId: author.id,
        category: input.category,
        votes: 0,
        comments: 0,
        color: palette[apps.length % palette.length],
        url: url ? url : undefined,
        repoUrl: repoUrl ? repoUrl : undefined,
        screenshots: screenshots.length ? screenshots : undefined,
        collaborators: collaborators.length ? collaborators : undefined,
        docs: docs ? docs : undefined,
        createdAt: new Date().toISOString(),
        viewerHasVoted: false,
      };
      const next = [item, ...apps];
      try {
        saveApps(next);
      } catch {
        throw new Error("Storage is full. Remove an image and try again.");
      }
      return item;
    },

    async updateApp(appId: string, author: User, patch: AppUpdate): Promise<AppItem> {
      await delay(150);
      const apps = loadApps();
      const target = apps.find((a) => a.id === appId);
      if (!target) throw new NotFoundError("Project not found.");
      const owned = target.creatorId
        ? target.creatorId === author.id
        : target.creator.toLowerCase() === author.name.toLowerCase();
      if (!owned) throw new Error("You can only edit your own projects.");
      const title = patch.title !== undefined ? patch.title.trim() : target.title;
      const description =
        patch.description !== undefined ? patch.description.trim() : target.description;
      const url = patch.url !== undefined ? patch.url.trim() : (target.url ?? "");
      const repoUrl = patch.repoUrl !== undefined ? patch.repoUrl.trim() : (target.repoUrl ?? "");
      const docs = patch.docs !== undefined ? patch.docs.trim() : (target.docs ?? "");
      if (!title) throw new Error("Title is required.");
      if (!description) throw new Error("Description is required.");
      if (title.length > 80) throw new Error("Keep the project name under 80 characters.");
      if (description.length > 280) throw new Error("Keep the description under 280 characters.");
      if (docs.length > 50000) throw new Error("Keep documentation under 50000 characters.");
      if (url && !/^https?:\/\//i.test(url)) throw new Error("App link must start with http(s)://.");
      const screenshots =
        patch.screenshots !== undefined
          ? patch.screenshots.filter(Boolean).slice(0, 3)
          : (target.screenshots ?? []);
      const collaborators =
        patch.collaborators !== undefined
          ? patch.collaborators.filter(Boolean).slice(0, 10)
          : (target.collaborators ?? []);
      for (const src of screenshots) {
        if (src.length > 500_000) throw new Error("Images are too large. Pick smaller files.");
      }
      const next = apps.map((a) =>
        a.id === appId
          ? {
              ...a,
              title,
              description,
              url: url ? url : undefined,
              repoUrl: repoUrl ? repoUrl : undefined,
              collaborators: collaborators.length ? collaborators : undefined,
              category: patch.category ?? a.category,
              screenshots: screenshots.length ? screenshots : undefined,
              docs: docs ? docs : undefined,
            }
          : a,
      );
      try {
        saveApps(next);
      } catch {
        throw new Error("Storage is full. Remove an image and try again.");
      }
      const updated = next.find((a) => a.id === appId)!;
      return withViewer([updated], author.id)[0];
    },

    async deleteApp(appId: string, author: User): Promise<void> {
      await delay(120);
      const apps = loadApps();
      const target = apps.find((a) => a.id === appId);
      if (!target) throw new NotFoundError("Project not found.");
      const owned = target.creatorId
        ? target.creatorId === author.id
        : target.creator.toLowerCase() === author.name.toLowerCase();
      if (!owned) throw new Error("You can only delete your own projects.");
      saveApps(apps.filter((a) => a.id !== appId));
      const comments = loadComments();
      if (comments[appId]) {
        const { [appId]: _removed, ...rest } = comments;
        saveComments(rest);
      }
      const votes = loadVotes();
      let votesMutated = false;
      const nextVotes: VotesStore = {};
      for (const [userId, ids] of Object.entries(votes)) {
        const filtered = ids.filter((id) => id !== appId);
        if (filtered.length !== ids.length) votesMutated = true;
        nextVotes[userId] = filtered;
      }
      if (votesMutated) saveVotes(nextVotes);
    },

    async toggleVote(appId: string, userId: string): Promise<AppItem> {
      await delay(80);
      const apps = loadApps();
      const votes = loadVotes();
      const votedIds = new Set(votes[userId] ?? []);
      const target = apps.find((a) => a.id === appId);
      if (!target) throw new NotFoundError("Project not found.");
      const hasVoted = votedIds.has(appId);
      if (hasVoted) votedIds.delete(appId);
      else votedIds.add(appId);
      const nextApps = apps.map((a) =>
        a.id === appId ? { ...a, votes: Math.max(0, a.votes + (hasVoted ? -1 : 1)) } : a,
      );
      saveApps(nextApps);
      saveVotes({ ...votes, [userId]: [...votedIds] });
      const updated = nextApps.find((a) => a.id === appId)!;
      return { ...updated, viewerHasVoted: !hasVoted };
    },

    async listBuilders(): Promise<Builder[]> {
      await delay(60);
      return [...seedBuilders];
    },

    async listComments(appId: string, userId?: string): Promise<Comment[]> {
      await delay(80);
      const store = loadComments();
      return [...(store[appId] ?? [])]
        .map(normalizeComment)
        .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
        .map((c) => ({
          ...c,
          viewerHasLiked: userId ? Boolean(c.likedBy?.includes(userId)) : false,
        }));
    },

    async addComment(appId: string, author: User, body: string, parentId?: string): Promise<Comment> {
      await delay(120);
      const text = body.trim();
      if (!text) throw new Error("Comment cannot be empty.");
      if (text.length > 500) throw new Error("Keep comments under 500 characters.");
      const apps = loadApps();
      const target = apps.find((a) => a.id === appId);
      if (!target) throw new NotFoundError("Project not found.");
      const store = loadComments();
      const thread = (store[appId] ?? []).map(normalizeComment);
      let parent: Comment | undefined;
      if (parentId) {
        parent = thread.find((c) => c.id === parentId);
        if (!parent) throw new Error("That comment no longer exists.");
        if (parent.appId !== appId) throw new Error("That comment belongs to another project.");
      }
      const comment: Comment = {
        id: newId(),
        appId,
        authorId: author.id,
        authorName: author.name,
        body: text,
        createdAt: new Date().toISOString(),
        parentId: parent ? parent.id : null,
        likes: 0,
        likedBy: [],
        viewerHasLiked: false,
      };
      const next = [...thread, comment];
      saveComments({ ...store, [appId]: next });
      saveApps(apps.map((a) => (a.id === appId ? { ...a, comments: next.length } : a)));
      return { ...comment, viewerHasLiked: false };
    },

    async listMilestones(userId?: string): Promise<Milestone[]> {
      await delay(80);
      return loadMilestones()
        .map(normalizeMilestone)
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
        .map((m) => ({
          ...m,
          viewerHasCheered: userId ? Boolean(m.cheeredBy?.includes(userId)) : false,
        }));
    },

    async postMilestone(author: User, body: string, appId?: string): Promise<Milestone> {
      await delay(120);
      const text = body.trim();
      if (!text) throw new Error("Update cannot be empty.");
      if (text.length > 280) throw new Error("Keep updates under 280 characters.");
      if (appId) {
        const apps = loadApps();
        const target = apps.find((a) => a.id === appId);
        if (!target) throw new NotFoundError("Project not found.");
        const owned = target.creatorId
          ? target.creatorId === author.id
          : target.creator.toLowerCase() === author.name.toLowerCase();
        if (!owned) throw new Error("You can only link your own projects.");
      }
      const milestone: Milestone = {
        id: newId(),
        authorId: author.id,
        authorName: author.name,
        body: text,
        appId: appId || undefined,
        createdAt: new Date().toISOString(),
        cheers: 0,
        cheeredBy: [],
        viewerHasCheered: false,
      };
      const next = [milestone, ...loadMilestones()];
      saveMilestones(next);
      return milestone;
    },

    async toggleMilestoneCheer(milestoneId: string, userId: string): Promise<Milestone> {
      await delay(80);
      const milestones = loadMilestones().map(normalizeMilestone);
      const target = milestones.find((m) => m.id === milestoneId);
      if (!target) throw new NotFoundError("Update not found.");
      const cheered = new Set(target.cheeredBy ?? []);
      if (cheered.has(userId)) cheered.delete(userId);
      else cheered.add(userId);
      const updated: Milestone = { ...target, cheeredBy: [...cheered], cheers: cheered.size };
      saveMilestones(milestones.map((m) => (m.id === milestoneId ? updated : m)));
      return { ...updated, viewerHasCheered: cheered.has(userId) };
    },

    async toggleCommentLike(appId: string, commentId: string, userId: string): Promise<Comment> {
      await delay(80);
      const store = loadComments();
      const thread = (store[appId] ?? []).map(normalizeComment);
      const target = thread.find((c) => c.id === commentId);
      if (!target) throw new NotFoundError("Comment not found.");
      const liked = new Set(target.likedBy ?? []);
      if (liked.has(userId)) liked.delete(userId);
      else liked.add(userId);
      const updated: Comment = { ...target, likedBy: [...liked], likes: liked.size };
      saveComments({
        ...store,
        [appId]: thread.map((c) => (c.id === commentId ? updated : c)),
      });
      return { ...updated, viewerHasLiked: liked.has(userId) };
    },
  };
}

export function resetLocalData(): void {
  localStorage.removeItem(APPS_KEY);
  localStorage.removeItem(VOTES_KEY);
  localStorage.removeItem(COMMENTS_KEY);
}
