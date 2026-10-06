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
  screenshots?: string[];
  docs?: string;
  createdAt: string;
  viewerHasVoted?: boolean;
};

export type AppInput = {
  title: string;
  description: string;
  url?: string;
  category: Category;
  screenshots?: string[];
  docs?: string;
};

export type AppUpdate = {
  title?: string;
  description?: string;
  url?: string;
  category?: Category;
  screenshots?: string[];
  docs?: string;
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

export type Profile = {
  id: string;
  name: string;
  role: string;
  bio: string;
  color: string;
  imageUrl?: string;
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

export type ActivityKind = "launch" | "feedback" | "milestone" | "join";

export type Activity = {
  id: string;
  text: string;
  time: string;
  color: string;
  kind: ActivityKind;
};
