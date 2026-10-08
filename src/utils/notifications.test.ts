import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  arrivalKeyOf,
  buildNotifications,
  bumpCollabTag,
  loadNotificationState,
  saveNotificationState,
  type NotificationInput,
} from "./notifications";
import type { AppItem, Comment, Milestone, User } from "../data/types";

const NOW = Date.parse("2026-10-07T12:00:00.000Z");
const H = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
});

beforeEach(() => {
  store.clear();
});

const ann: User = { id: "u1", email: "a@x.com", name: "Ann" };

function app(id: string, extra: Partial<AppItem> = {}): AppItem {
  return {
    id,
    title: `App ${id}`,
    description: "a description",
    creator: "Bob",
    creatorId: "u2",
    category: "Games",
    votes: 0,
    comments: 0,
    color: "sky",
    createdAt: H(50),
    ...extra,
  };
}

function comment(id: string, extra: Partial<Comment> = {}): Comment {
  return {
    id,
    appId: "mine",
    authorId: "u2",
    authorName: "Bob",
    body: "hello",
    createdAt: H(3),
    ...extra,
  };
}

function baseInput(over: Partial<NotificationInput> = {}): NotificationInput {
  return {
    user: ann,
    apps: [],
    threads: new Map(),
    milestones: [],
    baseline: {},
    nowMs: NOW,
    ...over,
  };
}

describe("buildNotifications", () => {
  it("orders newest arrival first across kinds", () => {
    const mine = app("mine", { creator: "Ann", creatorId: "u1" });
    const fresh = app("new1", { createdAt: H(4) });
    const threads = new Map<string, Comment[]>([
      [
        "mine",
        [
          comment("c1"),
          { ...comment("c0"), id: "c0", authorId: "u1", authorName: "Ann", createdAt: H(5) },
          { ...comment("c2"), id: "c2", createdAt: H(1), parentId: "c0" },
        ],
      ],
    ]);
    const milestones: Milestone[] = [
      { id: "m1", authorId: "u2", authorName: "Bob", body: "wall", createdAt: H(2) },
    ];
    const kinds = buildNotifications(baseInput({ apps: [mine, fresh], threads, milestones })).map(
      (i) => i.kind,
    );
    expect(kinds).toEqual(["reply", "update", "comment", "project"]);
  });

  it("detects replies once and skips own actions", () => {
    const mine = app("mine", { creator: "Ann", creatorId: "u1" });
    const threads = new Map<string, Comment[]>([
      [
        "mine",
        [
          comment("c1"),
          { ...comment("c2"), id: "c2", authorId: "u1", authorName: "Ann" },
          { ...comment("c3"), id: "c3", authorId: "u3", authorName: "Cat", parentId: "c2" },
          // Orphan reply (unknown parent) is not claimed as a reply to me.
          { ...comment("c9"), id: "c9", authorId: "u3", authorName: "Cat", parentId: "nope" },
        ],
      ],
    ]);
    const items = buildNotifications(baseInput({ apps: [mine], threads }));
    const ids = items.map((i) => i.id);
    expect(ids).toContain("c:c1");
    expect(ids).toContain("c:c3");
    expect(ids).not.toContain("c:c2");
    expect(ids.filter((id) => id === "c:c3")).toHaveLength(1);
    // Orphan reply (unknown parent) on my project still surfaces — as a
    // plain comment on my project, never as a reply to me.
    expect(items.find((i) => i.id === "c:c9")?.kind).toBe("comment");
  });

  it("reports vote gains vs the baseline only", () => {
    const mine = app("mine", { creator: "Ann", creatorId: "u1", votes: 5 });
    const gained = buildNotifications(baseInput({ apps: [mine], baseline: { mine: 3 } }));
    expect(gained.find((i) => i.kind === "vote")?.title).toBe("2 new upvotes on App mine");
    const silent = buildNotifications(baseInput({ apps: [mine], baseline: { mine: 5 } }));
    expect(silent.some((i) => i.kind === "vote")).toBe(false);
  });

  it("matches collab tags by id or profile-row name, never strangers", () => {
    const profiles = [
      { id: "mia", name: "Mia Santos", role: "r", bio: "", color: "sky", createdAt: H(9) },
    ];
    const mia: User = { id: "google-1", email: "m@x.com", name: "Mia Santos" };
    const tagged = app("p1", { collaborators: ["mia"] });
    const byName = buildNotifications(
      baseInput({ user: mia, apps: [tagged], profiles, baseline: {} }),
    );
    expect(byName.some((i) => i.kind === "collab")).toBe(true);
    const stranger: User = { id: "u9", email: "z@x.com", name: "Zed" };
    const none = buildNotifications(
      baseInput({ user: stranger, apps: [tagged], profiles, baseline: {} }),
    );
    expect(none.some((i) => i.kind === "collab")).toBe(false);
  });

  it("arrival keys are stable per content and change on edit", () => {
    const a = { id: "vote:x", title: "T", body: "5 total" };
    const b = { id: "vote:x", title: "T", body: "5 total" };
    const c = { id: "vote:x", title: "T", body: "6 total" };
    expect(arrivalKeyOf(a)).toBe(arrivalKeyOf(b));
    expect(arrivalKeyOf(a)).not.toBe(arrivalKeyOf(c));
  });
});

describe("collab tag snapshots", () => {
  const tagged = () => app("p1", { collaborators: ["u1"] });

  it("fires on first login, stays silent on title-only edits, re-fires on re-tag", () => {
    const load = () => loadNotificationState("u1");
    const input = () =>
      baseInput({
        apps: [tagged()],
        profiles: [],
        baseline: {},
        collabBaseline: load().collabBaseline,
      });
    const collabs = (uid: string) =>
      buildNotifications({
        ...input(),
        collabBaseline: loadNotificationState(uid).collabBaseline,
      }).filter((i) => i.kind === "collab").length;

    expect(collabs("u1")).toBe(1);

    // Mark all read, then a title-only edit (same tag set, no bump).
    const seen = buildNotifications({ ...input(), collabBaseline: load().collabBaseline });
    saveNotificationState("u1", {
      readIds: seen.map((i) => i.id),
      voteBaseline: {},
      collabBaseline: ["p1"],
      dismissedIds: [],
      seenAt: {},
    });
    expect(collabs("u1")).toBe(0);

    // Untag (offline) then re-tag via edit save: the uploader's bump clears it.
    bumpCollabTag("u1", "p1");
    expect(collabs("u1")).toBe(1);
  });

  it("bumpCollabTag is a no-op for unknown users", () => {
    bumpCollabTag("ghost", "p1");
    expect(loadNotificationState("ghost")).toEqual({
      readIds: [],
      voteBaseline: {},
      collabBaseline: [],
      dismissedIds: [],
      seenAt: {},
    });
  });

  it("tolerates legacy stored state without new fields", () => {
    store.set("cc.notif.v1:u1", JSON.stringify({ readIds: ["c:x"] }));
    expect(loadNotificationState("u1")).toEqual({
      readIds: ["c:x"],
      voteBaseline: {},
      collabBaseline: [],
      dismissedIds: [],
      seenAt: {},
    });
  });
});
