// Database row shapes (snake_case, as returned by the API / Supabase)
// and mappers to the app's camelCase domain types. The UI never imports this.

import type { AppItem, Comment, Milestone, Profile, User } from "../types";

export type ProfileRow = {
  id: string;
  name: string;
  role: string;
  bio: string;
  color: string;
  image_url: string | null;
  theme: string | null;
  palette: string | null;
  created_at: string;
};

export type AppRow = {
  id: string;
  title: string;
  description: string;
  creator: string;
  creator_id: string | null;
  category: AppItem["category"];
  votes: number;
  color: string;
  url: string | null;
  repo_url: string | null;
  screenshots: string[];
  docs: string | null;
  collaborators: string[];
  created_at: string;
  viewer_has_voted?: boolean;
  comments_count?: number;
};

export type CommentRow = {
  id: string;
  app_id: string;
  author_id: string;
  author_name: string;
  body: string;
  parent_id: string | null;
  likes: number;
  created_at: string;
  viewer_has_liked?: boolean;
};

export type MilestoneRow = {
  id: string;
  author_id: string;
  author_name: string;
  body: string;
  app_id: string | null;
  cheers: number;
  created_at: string;
  viewer_has_cheered?: boolean;
};

export function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    bio: row.bio,
    color: row.color,
    imageUrl: row.image_url ?? undefined,
    theme: row.theme ?? undefined,
    palette: row.palette ?? undefined,
    createdAt: row.created_at,
  };
}

export function toApp(row: AppRow, commentsCount?: number): AppItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    creator: row.creator,
    creatorId: row.creator_id ?? undefined,
    category: row.category,
    votes: row.votes,
    comments: row.comments_count ?? commentsCount ?? 0,
    color: row.color,
    url: row.url ?? undefined,
    repoUrl: row.repo_url ?? undefined,
    screenshots: row.screenshots.length ? row.screenshots : undefined,
    docs: row.docs ?? undefined,
    collaborators: row.collaborators.length ? row.collaborators : undefined,
    createdAt: row.created_at,
    viewerHasVoted: row.viewer_has_voted,
  };
}

export function toComment(row: CommentRow): Comment {
  return {
    id: row.id,
    appId: row.app_id,
    authorId: row.author_id,
    authorName: row.author_name,
    body: row.body,
    createdAt: row.created_at,
    parentId: row.parent_id,
    likes: row.likes,
    viewerHasLiked: row.viewer_has_liked,
  };
}

export function toMilestone(row: MilestoneRow): Milestone {
  return {
    id: row.id,
    authorId: row.author_id,
    authorName: row.author_name,
    body: row.body,
    appId: row.app_id ?? undefined,
    createdAt: row.created_at,
    cheers: row.cheers,
    viewerHasCheered: row.viewer_has_cheered,
  };
}

export function toUser(payload: { id: string; email: string; name: string }): User {
  return { id: payload.id, email: payload.email, name: payload.name };
}
