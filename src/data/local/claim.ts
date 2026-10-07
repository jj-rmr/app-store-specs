import { NotFoundError } from "../repositories";
import type { AppItem, Comment, Milestone, Profile, User } from "../types";

const PROFILES_KEY = "cc.profiles.v1";
const APPS_KEY = "cc.apps.v1";
const VOTES_KEY = "cc.votes.v1";
const COMMENTS_KEY = "cc.comments.v1";
const MILESTONES_KEY = "cc.milestones.v1";
const GOOGLE_USERS_KEY = "cc.google_users.v1";
const NAMES_KEY = "cc.display_names.v1";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function reassign(list: string[], from: string, to: string): string[] {
  const next = list.map((id) => (id === from ? to : id));
  return [...new Set(next)];
}

/**
 * Merge a duplicate profile into the requester's account. Only allowed when
 * the duplicate carries the requester's exact display name. Moves projects,
 * comments, milestones, votes, and likes, then removes the duplicate row.
 */
export function claimDuplicateProfile(duplicateProfileId: string, requester: User): Profile {
  const profiles = read<Profile[]>(PROFILES_KEY, []);
  const duplicate = profiles.find((p) => p.id === duplicateProfileId);
  if (!duplicate) throw new NotFoundError("Developer not found.");
  if (duplicate.id === requester.id) throw new Error("That is already your profile.");
  if (duplicate.name.trim().toLowerCase() !== requester.name.trim().toLowerCase()) {
    throw new Error("You can only claim a profile with your exact display name.");
  }

  const from = duplicate.id;
  const to = requester.id;

  const apps = read<AppItem[]>(APPS_KEY, []).map((a) =>
    a.creatorId === from ? { ...a, creatorId: to, creator: requester.name } : a,
  );
  write(APPS_KEY, apps);

  const commentsStore = read<Record<string, Comment[]>>(COMMENTS_KEY, {});
  const nextComments: Record<string, Comment[]> = {};
  for (const [appId, thread] of Object.entries(commentsStore)) {
    nextComments[appId] = thread.map((c) => ({
      ...c,
      authorId: c.authorId === from ? to : c.authorId,
      authorName: c.authorId === from ? requester.name : c.authorName,
      likedBy: c.likedBy ? reassign(c.likedBy, from, to) : c.likedBy,
    }));
  }
  write(COMMENTS_KEY, nextComments);

  const milestones = read<Milestone[]>(MILESTONES_KEY, []).map((m) => ({
    ...m,
    authorId: m.authorId === from ? to : m.authorId,
    authorName: m.authorId === from ? requester.name : m.authorName,
    cheeredBy: m.cheeredBy ? reassign(m.cheeredBy, from, to) : m.cheeredBy,
  }));
  write(MILESTONES_KEY, milestones);

  const votes = read<Record<string, string[]>>(VOTES_KEY, {});
  const merged = new Set([...(votes[to] ?? []), ...(votes[from] ?? [])]);
  const nextVotes: Record<string, string[]> = { ...votes, [to]: [...merged] };
  delete nextVotes[from];
  write(VOTES_KEY, nextVotes);

  const googleUsers = read<Record<string, { id: string; email: string; name: string }>>(
    GOOGLE_USERS_KEY,
    {},
  );
  let googleMutated = false;
  for (const record of Object.values(googleUsers)) {
    if (record.id === from) {
      record.id = to;
      googleMutated = true;
    }
  }
  if (googleMutated) write(GOOGLE_USERS_KEY, googleUsers);

  const overrides = read<Record<string, string>>(NAMES_KEY, {});
  if (overrides[from] !== undefined && overrides[to] === undefined) {
    write(NAMES_KEY, { ...overrides, [to]: overrides[from] });
  }

  const remaining = profiles.filter((p) => p.id !== from);
  write(PROFILES_KEY, remaining);

  const owner =
    remaining.find((p) => p.id === to) ??
    ({
      id: to,
      name: requester.name,
      role: "SPECS member",
      bio: "Exploring student-built software across the community.",
      color: "sky",
      createdAt: new Date().toISOString(),
    } as Profile);
  if (!remaining.some((p) => p.id === to)) write(PROFILES_KEY, [...remaining, owner]);
  return owner;
}
