export type Category = "Education" | "Productivity" | "Games" | "Creative";

export type CategoryFilter = Category | "All";

export type User = {
  id: string;
  email: string;
  name: string;
};

export type AppItem = {
  id: string;
  title: string;
  description: string;
  creator: string;
  creatorId?: string;
  category: Category;
  votes: number;
  comments: number;
  color: string;
  url?: string;
  repoUrl?: string;
  screenshots?: string[];
  docs?: string;
  collaborators?: string[];
  createdAt: string;
  viewerHasVoted?: boolean;
};

export type AppInput = {
  title: string;
  description: string;
  url?: string;
  repoUrl?: string;
  category: Category;
  screenshots?: string[];
  docs?: string;
  collaborators?: string[];
};

export type AppUpdate = {
  title?: string;
  description?: string;
  url?: string;
  repoUrl?: string;
  category?: Category;
  screenshots?: string[];
  docs?: string;
  collaborators?: string[];
};

export type ListAppsParams = {
  query?: string;
  category?: CategoryFilter;
  limit?: number;
  offset?: number;
  userId?: string;
};

export type Builder = {
  name: string;
  role: string;
  apps: number;
  color: string;
};

/** Allowlisted profile-page theme palettes (CSS vars must exist for each). */
export const PROFILE_THEMES = [
  "pink",
  "yellow",
  "mint",
  "sky",
  "lavender",
  "purple",
  "black",
] as const;

/**
 * Allowlisted website palettes (data-palette values in styles/tailwind.css).
 * Single source of truth — utils/palette.ts builds its UI list from this,
 * and repos validate against it.
 */
export const SITE_PALETTE_IDS = [
  "candy",
  "ocean",
  "sunset",
  "forest",
  "mono",
  "bubblegum",
  "citrus",
  "grape",
  "midnight",
] as const;

export type Profile = {
  id: string;
  name: string;
  role: string;
  bio: string;
  color: string;
  imageUrl?: string;
  /** Profile-page palette. Absent = default look (backward compatible). */
  theme?: string;
  /**
   * Website palette for this account (Not to confuse with the profile
   * page theme above: palette recolors the whole site for the viewer,
   * theme recolors one profile page for its visitors). Absent = device
   * choice (backward compatible).
   */
  palette?: string;
  createdAt: string;
};

export type Comment = {
  id: string;
  appId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
  parentId?: string | null;
  likes?: number;
  likedBy?: string[];
  viewerHasLiked?: boolean;
};

export type Milestone = {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  appId?: string;
  createdAt: string;
  cheers?: number;
  cheeredBy?: string[];
  viewerHasCheered?: boolean;
};

export type NotificationKind = "comment" | "reply" | "vote" | "project" | "update" | "collab";

export type NotificationItem = {
  /** Stable id: `c:<commentId>`, `vote:<appId>`, `app:<appId>`, `m:<milestoneId>`. */
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: string;
  /** Project to open when the notification is clicked. */
  appId?: string;
  actorName?: string;
};
