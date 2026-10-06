import type { AppItem, Comment, Profile } from "./types";

export function indexProfiles(profiles: Profile[]): Map<string, Profile> {
  const byId = new Map<string, Profile>();
  const byName = new Map<string, Profile>();
  for (const p of profiles) {
    byId.set(p.id, p);
    byName.set(p.name.trim().toLowerCase(), p);
  }
  // Prefer id lookup, fall back to name for legacy seed rows.
  return new Map([
    ...[...byName.entries()].map(([k, v]) => [`name:${k}`, v] as [string, Profile]),
    ...byId,
  ]);
}

export function profileIdForApp(app: AppItem, lookup: Map<string, Profile>): string | null {
  if (app.creatorId && lookup.has(app.creatorId)) return app.creatorId;
  const byName = lookup.get(`name:${app.creator.trim().toLowerCase()}`);
  return byName ? byName.id : null;
}

export function profileForApp(app: AppItem, lookup: Map<string, Profile>): Profile | null {
  if (app.creatorId && lookup.has(app.creatorId)) return lookup.get(app.creatorId)!;
  return lookup.get(`name:${app.creator.trim().toLowerCase()}`) ?? null;
}

export function profileForComment(
  comment: Comment,
  lookup: Map<string, Profile>,
): Profile | null {
  if (lookup.has(comment.authorId)) return lookup.get(comment.authorId)!;
  return lookup.get(`name:${comment.authorName.trim().toLowerCase()}`) ?? null;
}
