import type { AppItem, Comment, Milestone, NotificationItem, Profile, User } from "../data/types";

/**
 * Derived notifications (no backend changes).
 *
 * The app has no notification table, and vote rows carry no per-voter
 * timestamp in local mode, so notifications are computed from data the UI
 * already reads: apps, comment threads, milestones, and vote counts.
 *
 * - comment: someone commented on one of my projects.
 * - reply: someone replied to one of my comments (any project).
 * - vote: upvote count on one of my projects grew since the last
 *   read snapshot (aggregate — per-voter timestamps don't exist locally).
 * - collab: another developer tagged me as a collaborator on their project
 *   (id match, or name match against a tagged profile row — uploaders pick
 *   from seed/duplicate profile rows whose id often differs from the
 *   developer's real login id, so id-only matching silently drops the tag).
 *   Fires when tagged and absent from the last snapshot; the uploader's save
 *   also re-arms the tag (bumpCollabTag), so remove → re-add across edits
 *   notifies again even if the tagged dev never loaded the app mid-gap.
 * - project: a new community project (7d window, not mine).
 * - update: a recent community milestone (7d window, not mine).
 *
 * Read state (read ids + vote baseline) lives in localStorage per user.
 * Nothing here changes any repo contract or server schema.
 */

export const NOTIF_SCAN_APP_LIMIT = 50;
export const NOTIF_LIST_LIMIT = 30;
const COMMUNITY_WINDOW_MS = 7 * 24 * 3_600_000;
const MAX_READ_IDS = 200;
const BODY_PREVIEW = 120;

export type NotificationState = {
  readIds: string[];
  voteBaseline: Record<string, number>;
  /** App ids the user was tagged on at the last snapshot (re-tag re-fires). */
  collabBaseline: string[];
  /** Dismissed (deleted) ids — hidden from the list, not just marked read. */
  dismissedIds: string[];
  /** First-seen timestamps per arrival key (see arrivalKeyOf) — sort order. */
  seenAt: Record<string, string>;
};

const keyFor = (userId: string) => `cc.notif.v1:${userId}`;

function cleanIds(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((id): id is string => typeof id === "string").slice(0, MAX_READ_IDS)
    : [];
}

function cleanTimes(value: unknown): Record<string, string> {
  if (typeof value !== "object" || value === null) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof k === "string" && typeof v === "string" && !Number.isNaN(Date.parse(v))) {
      out[k] = v;
    }
  }
  return out;
}

export function loadNotificationState(userId: string | undefined): NotificationState {
  const empty: NotificationState = {
    readIds: [],
    voteBaseline: {},
    collabBaseline: [],
    dismissedIds: [],
    seenAt: {},
  };
  if (!userId) return empty;
  try {
    const raw = localStorage.getItem(keyFor(userId));
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<NotificationState>;
    return {
      readIds: cleanIds(parsed.readIds),
      voteBaseline:
        typeof parsed.voteBaseline === "object" && parsed.voteBaseline !== null
          ? (parsed.voteBaseline as Record<string, number>)
          : {},
      collabBaseline: cleanIds(parsed.collabBaseline),
      dismissedIds: cleanIds(parsed.dismissedIds),
      seenAt: cleanTimes(parsed.seenAt),
    };
  } catch {
    return empty;
  }
}

export function saveNotificationState(userId: string, state: NotificationState): void {
  try {
    localStorage.setItem(
      keyFor(userId),
      JSON.stringify({
        readIds: state.readIds.slice(0, MAX_READ_IDS),
        voteBaseline: state.voteBaseline,
        collabBaseline: state.collabBaseline,
        dismissedIds: state.dismissedIds.slice(0, MAX_READ_IDS),
        seenAt: state.seenAt,
      }),
    );
  } catch {
    // Private mode / quota — notifications still work for the session.
  }
}

function truncate(s: string, n: number): string {
  const clean = s.trim().replace(/\s+/g, " ");
  return clean.length > n ? `${clean.slice(0, n - 1)}…` : clean;
}

function ownsApp(app: AppItem, user: User): boolean {
  return app.creatorId
    ? app.creatorId === user.id
    : app.creator.toLowerCase() === user.name.toLowerCase();
}

/**
 * Re-arm a collaborator tag as unread for the tagged user. Called from the
 * uploader's session when a save ADDS a tag: it clears the app from that
 * user's tag snapshot and read receipts, so the tag notifies as new even if
 * they previously read it (remove → re-add across edits). Same-browser only
 * (shared localStorage); a tagged user on another device still gets
 * first-seen tags via the derived fallback when they next load the app.
 * No-ops for unknown users — their first login surfaces the tag anyway.
 */
export function bumpCollabTag(taggedUserId: string, appId: string): void {
  if (!taggedUserId || !appId) return;
  const state = loadNotificationState(taggedUserId);
  const next: NotificationState = {
    ...state,
    collabBaseline: state.collabBaseline.filter((id) => id !== appId),
    readIds: state.readIds.filter((id) => id !== `collab:${appId}`),
  };
  if (
    next.collabBaseline.length === state.collabBaseline.length &&
    next.readIds.length === state.readIds.length
  ) {
    return;
  }
  saveNotificationState(taggedUserId, next);
}

function validDate(iso: string): boolean {
  return !Number.isNaN(Date.parse(iso));
}

export type NotificationInput = {
  user: User;
  apps: AppItem[];
  /** appId -> comments (already fetched by the caller, capped). */
  threads: Map<string, Comment[]>;
  milestones: Milestone[];
  /** Last-read vote counts per owned app. */
  baseline: Record<string, number>;
  /** App ids tagged at the last snapshot — re-tags after untag re-fire. */
  collabBaseline?: string[];
  /** All known profiles — resolves tagged ids to names for the fallback. */
  profiles?: Profile[];
  /**
   * First-seen timestamps per arrival key (see arrivalKeyOf). Aggregates
   * without event time (vote gains, collab tags on old projects) sort by
   * arrival instead of sinking to their project's old date. Missing entries
   * fall back to createdAt.
   */
  arrivalAt?: Record<string, string>;
  nowMs?: number;
};

/** Short deterministic content hash (hex-ish base36). */
function hashStr(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/**
 * Arrival identity of an item: stable id + content version. Edited content
 * (new title/body from a project edit, new vote total) yields a new key, so
 * the edit arrives fresh at the very top; identical content keeps its stamp.
 * Read/unread/delete tracking stays on the stable id.
 */
export function arrivalKeyOf(item: Pick<NotificationItem, "id" | "title" | "body">): string {
  return `${item.id}:${hashStr(`${item.title}\n${item.body}`)}`;
}

/**
 * Is this user tagged as a collaborator on someone else's project?
 * Id match first, then profile-row name match (the picker lists
 * seed/duplicate rows whose id rarely equals the login id).
 */
export function isTaggedCollaborator(app: AppItem, user: User, profiles: Profile[] = []): boolean {
  const mine = app.creatorId
    ? app.creatorId === user.id
    : app.creator.toLowerCase() === user.name.toLowerCase();
  if (mine) return false;
  const myName = user.name.trim().toLowerCase();
  const nameById = new Map(profiles.map((p) => [p.id, p.name]));
  return (app.collaborators ?? []).some(
    (id) => id === user.id || (nameById.get(id)?.trim().toLowerCase() ?? "") === myName,
  );
}

export function buildNotifications(input: NotificationInput): NotificationItem[] {
  const { user, apps, threads, milestones, baseline } = input;
  const nowMs = input.nowMs ?? Date.now();
  const items: NotificationItem[] = [];

  const appById = new Map(apps.map((a) => [a.id, a]));
  const myAppIds = new Set(apps.filter((a) => ownsApp(a, user)).map((a) => a.id));

  // Index every visible comment once for reply lookup.
  const commentById = new Map<string, Comment>();
  for (const list of threads.values()) {
    for (const c of list) {
      if (!commentById.has(c.id)) commentById.set(c.id, c);
    }
  }

  for (const list of threads.values()) {
    for (const c of list) {
      if (c.authorId === user.id) continue;
      if (!validDate(c.createdAt)) continue;
      const app = appById.get(c.appId);
      const appTitle = app?.title ?? "a project";
      if (c.parentId) {
        const parent = commentById.get(c.parentId);
        // Reply to me — on my project or anyone else's.
        if (parent && parent.authorId === user.id) {
          items.push({
            id: `c:${c.id}`,
            kind: "reply",
            title: `${c.authorName} replied to you${app ? ` on ${appTitle}` : ""}`,
            body: truncate(c.body, BODY_PREVIEW),
            createdAt: c.createdAt,
            appId: c.appId,
            actorName: c.authorName,
          });
          continue;
        }
      }
      // Plain comment on one of my projects.
      if (myAppIds.has(c.appId)) {
        items.push({
          id: `c:${c.id}`,
          kind: "comment",
          title: `${c.authorName} commented on ${appTitle}`,
          body: truncate(c.body, BODY_PREVIEW),
          createdAt: c.createdAt,
          appId: c.appId,
          actorName: c.authorName,
        });
      }
    }
  }

  // New upvotes since the last read snapshot (aggregate — no per-vote
  // timestamps exist in local mode; createdAt reuses the project date
  // for stable sorting and the body states the diff explicitly).
  for (const app of apps) {
    if (!myAppIds.has(app.id)) continue;
    const before = typeof baseline[app.id] === "number" ? baseline[app.id] : app.votes;
    const gained = app.votes - before;
    if (gained > 0 && validDate(app.createdAt)) {
      items.push({
        id: `vote:${app.id}`,
        kind: "vote",
        title: `${gained} new upvote${gained === 1 ? "" : "s"} on ${app.title}`,
        body: `${app.votes} total`,
        createdAt: app.createdAt,
        appId: app.id,
      });
    }
  }

  // Tagged as a collaborator on someone else's project. Fires when tagged
  // and absent from the last snapshot, so untag + re-tag across project
  // edits notifies again. Own projects never notify.
  const seenTags = new Set(input.collabBaseline ?? []);
  for (const app of apps) {
    if (myAppIds.has(app.id)) continue;
    if (!isTaggedCollaborator(app, user, input.profiles)) continue;
    if (seenTags.has(app.id)) continue;
    if (!validDate(app.createdAt)) continue;
    items.push({
      id: `collab:${app.id}`,
      kind: "collab",
      title: `${app.creator} added you as a collaborator on ${app.title}`,
      body: truncate(app.description, BODY_PREVIEW),
      createdAt: app.createdAt,
      appId: app.id,
      actorName: app.creator,
    });
  }

  // New community projects (7d, not mine).
  for (const app of apps) {
    if (myAppIds.has(app.id)) continue;
    if (app.creatorId === user.id) continue;
    if (!validDate(app.createdAt)) continue;
    if (nowMs - Date.parse(app.createdAt) > COMMUNITY_WINDOW_MS) continue;
    items.push({
      id: `app:${app.id}`,
      kind: "project",
      title: `New project: ${app.title}`,
      body: `by ${app.creator} · ${truncate(app.description, BODY_PREVIEW)}`,
      createdAt: app.createdAt,
      appId: app.id,
      actorName: app.creator,
    });
  }

  // Feed posts (7d, not mine).
  for (const m of milestones) {
    if (m.authorId === user.id) continue;
    if (!validDate(m.createdAt)) continue;
    if (nowMs - Date.parse(m.createdAt) > COMMUNITY_WINDOW_MS) continue;
    items.push({
      id: `m:${m.id}`,
      kind: "update",
      title: `${m.authorName} posted an update`,
      body: truncate(m.body, BODY_PREVIEW),
      createdAt: m.createdAt,
      appId: m.appId,
      actorName: m.authorName,
    });
  }

  // Newest arrival first, always — no kind grouping. Aggregates without
  // event time (vote gains, tags on old projects) arrive with a first-seen
  // stamp, so fresh news tops the list instead of sinking to an old date.
  // The stamp key includes a content version, so an edit resurfaces at the
  // top; identical content keeps its stamp. Fallbacks: createdAt, then id —
  // so a same-tick initial inbox still orders newest-content-first.
  const arrival = input.arrivalAt ?? {};
  const stampOf = (item: NotificationItem) => {
    const seen = arrival[arrivalKeyOf(item)];
    return seen !== undefined && !Number.isNaN(Date.parse(seen)) ? seen : item.createdAt;
  };
  return items
    .sort(
      (a, b) =>
        +new Date(stampOf(b)) - +new Date(stampOf(a)) ||
        +new Date(b.createdAt) - +new Date(a.createdAt) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, NOTIF_LIST_LIMIT);
}

/** Current vote counts for owned apps — the next read snapshot baseline. */
export function currentVoteBaseline(apps: AppItem[], user: User): Record<string, number> {
  const baseline: Record<string, number> = {};
  for (const app of apps) {
    if (ownsApp(app, user)) baseline[app.id] = app.votes;
  }
  return baseline;
}
