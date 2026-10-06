import type { AppItem, Profile } from "../data/types";

export type RankedDeveloper = {
  profile: Profile;
  projects: number;
  points: number;
};

function appsFor(p: Profile, apps: AppItem[]): AppItem[] {
  return apps.filter((a) =>
    a.creatorId ? a.creatorId === p.id : a.creator.toLowerCase() === p.name.toLowerCase(),
  );
}

/** All developers sorted by rank points (summed project upvotes). Single source of truth. */
export function rankDevelopers(profiles: Profile[], apps: AppItem[]): RankedDeveloper[] {
  return profiles
    .map((profile) => {
      const mine = appsFor(profile, apps);
      return {
        profile,
        projects: mine.length,
        points: mine.reduce((n, a) => n + a.votes, 0),
      };
    })
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.projects - a.projects ||
        a.profile.name.localeCompare(b.profile.name),
    );
}

/** userId -> 1|2|3 for the current top three (only when they have points). */
export function topThreeTrophies(profiles: Profile[], apps: AppItem[]): Map<string, 1 | 2 | 3> {
  const map = new Map<string, 1 | 2 | 3>();
  rankDevelopers(profiles, apps)
    .slice(0, 3)
    .forEach((entry, i) => {
      if (entry.points > 0) map.set(entry.profile.id, (i + 1) as 1 | 2 | 3);
    });
  return map;
}

/** All projects sorted by upvotes. Single source of truth for project rank. */
export function rankProjects(apps: AppItem[]): AppItem[] {
  return [...apps].sort(
    (a, b) =>
      b.votes - a.votes ||
      b.comments - a.comments ||
      +new Date(b.createdAt) - +new Date(a.createdAt),
  );
}

/** appId -> 1|2|3 for the current top three projects (only when they have votes). */
export function topThreeProjectTrophies(apps: AppItem[]): Map<string, 1 | 2 | 3> {
  const map = new Map<string, 1 | 2 | 3>();
  rankProjects(apps)
    .slice(0, 3)
    .forEach((app, i) => {
      if (app.votes > 0) map.set(app.id, (i + 1) as 1 | 2 | 3);
    });
  return map;
}
