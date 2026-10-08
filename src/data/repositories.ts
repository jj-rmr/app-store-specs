import type {
  AppInput,
  AppItem,
  AppUpdate,
  Builder,
  Comment,
  ListAppsParams,
  Milestone,
  Profile,
  User,
} from "./types";

export type GoogleSignInResult = {
  user: User;
  picture?: string;
};

export type GoogleAccount = {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  emailVerified?: boolean;
  /** Raw Google access token. Local mode ignores it; http mode sends it for server verification. */
  accessToken?: string;
};

export type AuthRepo = {
  getSession(): Promise<User | null>;
  signin(email: string, password: string): Promise<User>;
  signup(name: string, email: string, password: string): Promise<User>;
  signinWithGoogleAccount(account: GoogleAccount): Promise<GoogleSignInResult>;
  signout(): Promise<void>;
  updateName(name: string): Promise<User>;
};

export type AppRepo = {
  listApps(params?: ListAppsParams): Promise<AppItem[]>;
  getApp(id: string, userId?: string): Promise<AppItem>;
  createApp(input: AppInput, author: User): Promise<AppItem>;
  updateApp(appId: string, author: User, patch: AppUpdate): Promise<AppItem>;
  deleteApp(appId: string, author: User): Promise<void>;
  toggleVote(appId: string, userId: string): Promise<AppItem>;
  /**
   * Profiles that upvoted a project, alphabetical by name. Only voters with
   * a resolvable profile are returned, so legacy seed counts may exceed the
   * list length — callers should treat the list as identities, not a count.
   */
  listVoters(appId: string): Promise<Profile[]>;
  listBuilders(): Promise<Builder[]>;
  listComments(appId: string, userId?: string): Promise<Comment[]>;
  addComment(appId: string, author: User, body: string, parentId?: string): Promise<Comment>;
  /**
   * Delete the author's own comment/reply plus its nested replies
   * (matches the parent_id ON DELETE CASCADE in SQL). Throws when the
   * requester is not the author.
   */
  deleteComment(appId: string, commentId: string, requester: User): Promise<void>;
  toggleCommentLike(appId: string, commentId: string, userId: string): Promise<Comment>;
  listMilestones(userId?: string): Promise<Milestone[]>;
  postMilestone(author: User, body: string, appId?: string): Promise<Milestone>;
  toggleMilestoneCheer(milestoneId: string, userId: string): Promise<Milestone>;
};

export type ProfilePatch = {
  role?: string;
  bio?: string;
  color?: string;
  imageUrl?: string;
  name?: string;
  /** Profile-page theme; empty string clears it back to default. */
  theme?: string;
  /** Website palette for the account; empty string clears it back to device choice. */
  palette?: string;
};

export type ProfileRepo = {
  listProfiles(): Promise<Profile[]>;
  getProfile(id: string): Promise<Profile>;
  getProfileByName(name: string): Promise<Profile | null>;
  ensureUserProfile(user: User): Promise<Profile>;
  updateProfile(id: string, patch: ProfilePatch, requesterId: string): Promise<Profile>;
  claimProfile(duplicateProfileId: string, requester: User): Promise<Profile>;
};

export class AuthError extends Error {
  constructor(message = "That email and password don't match.") {
    super(message);
    this.name = "AuthError";
  }
}

export class NotFoundError extends Error {
  constructor(message = "Not found.") {
    super(message);
    this.name = "NotFoundError";
  }
}
