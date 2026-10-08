import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  BookOpenText,
  ChatCircleDots,
  DownloadSimple,
  Eye,
  GameController,
  Gear,
  GraduationCap,
  HandsClapping,
  Heart,
  Images,
  Info,
  LinkSimple,
  MagnifyingGlass,
  Palette,
  PencilSimple,
  Plus,
  RocketLaunch,
  SignOut,
  Sparkle,
  SquaresFour,
  Trophy,
  User as UserIcon,
  UsersThree,
  Wrench,
  X,
} from "@phosphor-icons/react";
import { useAuth } from "../auth/AuthProvider";
import Brand from "../components/Brand";
import AppCard from "../components/AppCard";
import ErrorBoundary from "../components/ErrorBoundary";
import NotificationBell from "../components/NotificationBell";
import {
  NOTIF_SCAN_APP_LIMIT,
  arrivalKeyOf,
  buildNotifications,
  bumpCollabTag,
  currentVoteBaseline,
  isTaggedCollaborator,
  loadNotificationState,
  saveNotificationState,
} from "../utils/notifications";
import Comments from "../components/Comments";
import Avatar from "../components/Avatar";
import MarkdownFileViewer from "../components/MarkdownFileViewer";
import MarkdownTextarea from "../components/MarkdownTextarea";
import PagedMarkdown from "../components/PagedMarkdown";
import ProfileView from "../components/ProfileView";
import ProjectView from "../components/ProjectView";
import SettingsView from "../components/SettingsView";
import { Button, ButtonLabel } from "../components/Button";
import { getAppRepo, getProfileRepo } from "../data/factory";
import { indexProfiles } from "../data/profileLinks";
import { fileToThumbnailDataUrl } from "../utils/images";
import { resolvePalette, setPalette } from "../utils/palette";
import { extractMentionIds } from "../utils/mentions";
import { playNotificationSound, playVoteSound } from "../utils/sounds";
import { useScrollToForm } from "../utils/scroll";
import CollaboratorPicker from "../components/CollaboratorPicker";
import MentionInput from "../components/MentionInput";
import { readMarkdownFile } from "../utils/readMarkdownFile";
import {
  rankDevelopers,
  rankProjects,
  topThreeProjectTrophies,
  topThreeTrophies,
} from "../utils/rank";
import TrophyMark from "../components/TrophyMark";
import {
  isGitHubRepositoryUrl,
  listGitHubMarkdownFiles,
  readGitHubMarkdownFiles,
} from "../utils/readGitHubReadme";
import type {
  AppItem,
  Category,
  CategoryFilter,
  Comment,
  Milestone,
  NotificationItem,
  Profile,
} from "../data/types";

const categories: { label: CategoryFilter; Icon: typeof SquaresFour }[] = [
  { label: "All", Icon: SquaresFour },
  { label: "Education", Icon: GraduationCap },
  { label: "Productivity", Icon: Wrench },
  { label: "Games", Icon: GameController },
  { label: "Creative", Icon: Palette },
];

type StoreView =
  "discover" | "builders" | "community" | "leaderboard" | "profile" | "project" | "settings";

const routeForView: Record<Exclude<StoreView, "profile" | "project">, string> = {
  discover: "/store",
  builders: "/builders",
  community: "/community",
  leaderboard: "/leaderboard",
  settings: "/settings",
};

function parsePath(path: string): {
  view: StoreView;
  profileId: string | null;
  appId: string | null;
} {
  const clean = path.replace(/\/$/, "") || "/store";
  if (clean === "/profile") return { view: "profile", profileId: "__me__", appId: null };
  if (clean === "/builders" || clean === "/developers")
    return { view: "builders", profileId: null, appId: null };
  const builderMatch = clean.match(/^\/(builders|developers)\/(.+)$/);
  if (builderMatch)
    return { view: "profile", profileId: decodeURIComponent(builderMatch[2]), appId: null };
  const appMatch = clean.match(/^\/(apps|store|projects)\/(.+)$/);
  if (appMatch && clean !== "/store")
    return { view: "project", profileId: null, appId: decodeURIComponent(appMatch[2]) };
  if (clean === "/community") return { view: "community", profileId: null, appId: null };
  if (clean === "/leaderboard") return { view: "leaderboard", profileId: null, appId: null };
  if (clean === "/settings") return { view: "settings", profileId: null, appId: null };
  return { view: "discover", profileId: null, appId: null };
}

const copyForView: Record<StoreView, { stamp: string; title: string; description: string }> = {
  discover: {
    stamp: "Student project catalog",
    title: "Explore student-built software.",
    description: "Search projects by name, category, or developer.",
  },
  builders: {
    stamp: "SPECS contributors",
    title: "Meet the developers.",
    description: "Open a profile to see their projects and feedback.",
  },
  community: {
    stamp: "Community activity",
    title: "What the community is working on.",
    description: "Recent project updates, feedback, and milestones from across SPECS.",
  },
  leaderboard: {
    stamp: "Top contributors",
    title: "Developer leaderboard.",
    description: "Rank points are the sum of upvotes across every project a developer shared.",
  },
  settings: {
    stamp: "Your preferences",
    title: "Settings.",
    description: "Sounds and demo data live on this device.",
  },
  profile: {
    stamp: "Developer profile",
    title: "Projects and feedback.",
    description: "See what they built and what the community is saying.",
  },
  project: {
    stamp: "Project showcase",
    title: "Details, screenshots, and docs.",
    description: "Explore the build, meet the developer, and leave feedback.",
  },
};

export default function Store() {
  const { user, signout } = useAuth();
  const [apps, setApps] = useState<AppItem[]>([]);
  const [appsLoading, setAppsLoading] = useState(true);
  const [appsError, setAppsError] = useState<string | null>(null);
  const [fullApps, setFullApps] = useState<AppItem[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [profileTick, setProfileTick] = useState(0);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [milestonesLoading, setMilestonesLoading] = useState(true);
  const [milestonesError, setMilestonesError] = useState<string | null>(null);
  const [mBody, setMBody] = useState("");
  const [mAppId, setMAppId] = useState("");
  const [mPosting, setMPosting] = useState(false);
  const [mPostError, setMPostError] = useState<string | null>(null);
  const [cheerPending, setCheerPending] = useState<Set<string>>(new Set());
  const [openThreads, setOpenThreads] = useState<Set<string>>(new Set());

  const toggleThread = (id: string) => {
    setOpenThreads((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const [query, setQuery] = useState("");
  const [devQuery, setDevQuery] = useState("");
  const [msQuery, setMsQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("All");
  const [showForm, setShowForm] = useState(false);
  const submitFormRef = useRef<HTMLFormElement>(null);
  useScrollToForm(showForm, submitFormRef);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [collabIds, setCollabIds] = useState<string[]>([]);
  const [url, setUrl] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [categoryInput, setCategoryInput] = useState<Category>("Productivity");
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [docs, setDocs] = useState("");
  const [docsTab, setDocsTab] = useState<"write" | "upload" | "repository" | "preview">("write");
  const [docsPreviewReturnTab, setDocsPreviewReturnTab] = useState<
    "write" | "upload" | "repository"
  >("write");
  const [docsFile, setDocsFile] = useState<string | null>(null);
  const [repositoryFiles, setRepositoryFiles] = useState<string[]>([]);
  const [selectedRepositoryFiles, setSelectedRepositoryFiles] = useState<string[]>([]);
  const [repositoryFilesLoading, setRepositoryFilesLoading] = useState(false);
  const [repositoryFilesImporting, setRepositoryFilesImporting] = useState(false);
  const [repositoryFilesError, setRepositoryFilesError] = useState<string | null>(null);
  const repositoryRequest = useRef<AbortController | null>(null);
  const [imgError, setImgError] = useState<string | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const initial = parsePath(window.location.pathname);
  const [view, setView] = useState<StoreView>(initial.view);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(initial.profileId);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(initial.appId);
  const [projectEdit, setProjectEdit] = useState(false);

  const profilesLookup = useMemo(() => indexProfiles(profiles), [profiles]);

  const countFor = useCallback(
    (p: Profile) =>
      fullApps.filter((a) =>
        a.creatorId ? a.creatorId === p.id : a.creator.toLowerCase() === p.name.toLowerCase(),
      ).length,
    [fullApps],
  );

  // Rank points: sum of upvotes across every project a developer shared.
  const rankedDevelopers = useMemo(() => rankDevelopers(profiles, fullApps), [profiles, fullApps]);

  const devQueryLower = devQuery.trim().toLowerCase();
  const filteredProfiles = devQueryLower
    ? profiles.filter((p) => `${p.name} ${p.role}`.toLowerCase().includes(devQueryLower))
    : profiles;
  const msQueryLower = msQuery.trim().toLowerCase();
  const filteredMilestones = msQueryLower
    ? milestones.filter((m) => `${m.body} ${m.authorName}`.toLowerCase().includes(msQueryLower))
    : milestones;

  // userId -> 1|2|3 for the current top three. Recomputed every render from
  // live state, so trophies appear, move, and disappear as ranks change.
  const trophies = useMemo(() => topThreeTrophies(profiles, fullApps), [profiles, fullApps]);
  const projectTrophies = useMemo(() => topThreeProjectTrophies(fullApps), [fullApps]);
  const rankedProjects = useMemo(() => rankProjects(fullApps), [fullApps]);
  const [boardTab, setBoardTab] = useState<"developers" | "projects">("developers");

  useEffect(() => {
    const onPopState = () => {
      const parsed = parsePath(window.location.pathname);
      setView(parsed.view);
      setSelectedProfileId(parsed.profileId);
      setSelectedAppId(parsed.appId);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (user) {
          await getProfileRepo().ensureUserProfile(user);
        }
        const list = await getProfileRepo().listProfiles();
        if (cancelled) return;
        setProfiles(list);
        if (user) {
          const mine = list.find((p) => p.id === user.id) ?? null;
          setMyProfile(mine);
          // The website palette lives on the account: a login carries it to
          // this browser, falling back to the device choice when unset.
          if (mine) setPalette(resolvePalette(mine.palette));
        }
      } catch {
        if (!cancelled) setProfiles([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, profileTick]);

  // Bumped by the background poll below; threads + milestones rescan on it.
  const [pollTick, setPollTick] = useState(0);
  const milestoneReq = useRef(0);
  const loadMilestones = useCallback(
    async (quiet = false) => {
      const req = ++milestoneReq.current;
      if (!quiet) {
        setMilestonesLoading(true);
        setMilestonesError(null);
      }
      try {
        const items = await getAppRepo().listMilestones(user?.id);
        if (milestoneReq.current !== req) return;
        setMilestones(items);
      } catch (e) {
        if (!quiet && milestoneReq.current === req)
          setMilestonesError(e instanceof Error ? e.message : "Could not load updates.");
      } finally {
        if (!quiet && milestoneReq.current === req) setMilestonesLoading(false);
      }
    },
    [user?.id],
  );

  useEffect(() => {
    void loadMilestones(pollTick > 0);
  }, [loadMilestones, pollTick]);

  const postMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !mBody.trim() || mPosting) return;
    setMPosting(true);
    setMPostError(null);
    try {
      const created = await getAppRepo().postMilestone(user, mBody.trim(), mAppId || undefined);
      setMilestones((items) => [created, ...items]);
      setMBody("");
      setMAppId("");
    } catch (err) {
      setMPostError(err instanceof Error ? err.message : "Could not post update.");
    } finally {
      setMPosting(false);
    }
  };

  const cheer = async (m: Milestone) => {
    if (!user || cheerPending.has(m.id)) return;
    setCheerPending((prev) => new Set(prev).add(m.id));
    const wasCheered = Boolean(m.viewerHasCheered);
    setMilestones((items) =>
      items.map((x) =>
        x.id === m.id
          ? {
              ...x,
              viewerHasCheered: !wasCheered,
              cheers: Math.max(0, (x.cheers ?? 0) + (wasCheered ? -1 : 1)),
            }
          : x,
      ),
    );
    try {
      const updated = await getAppRepo().toggleMilestoneCheer(m.id, user.id);
      setMilestones((items) => items.map((x) => (x.id === m.id ? { ...x, ...updated } : x)));
    } catch {
      setMilestones((items) => items.map((x) => (x.id === m.id ? m : x)));
    } finally {
      setCheerPending((prev) => {
        const next = new Set(prev);
        next.delete(m.id);
        return next;
      });
    }
  };

  const loadApps = useCallback(
    async (quiet = false) => {
      if (!quiet) {
        setAppsLoading(true);
        setAppsError(null);
      }
      try {
        const [filtered, all] = await Promise.all([
          getAppRepo().listApps({ query, category, userId: user?.id }),
          getAppRepo().listApps({ limit: 200, userId: user?.id }),
        ]);
        setApps(filtered);
        setFullApps(all);
      } catch (e) {
        if (!quiet) setAppsError(e instanceof Error ? e.message : "Could not load projects.");
      } finally {
        if (!quiet) setAppsLoading(false);
      }
    },
    [query, category, user?.id],
  );

  useEffect(() => {
    void loadApps();
  }, [loadApps]);

  // Quiet background refresh (signed in, tab visible): picks up other
  // builders' projects, votes, comments, and wall updates so the bell can
  // chime without any taps. Silent flags — no loading spinners.
  useEffect(() => {
    if (!user) return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      void loadApps(true);
      void loadMilestones(true);
      setPollTick((t) => t + 1);
    }, 45_000);
    return () => window.clearInterval(timer);
  }, [user?.id, loadApps, loadMilestones]);

  // ── Notifications (derived — no repo/backend changes) ───────────────────
  // Comment threads are scanned across my projects + the newest community
  // projects (capped). Vote "events" are count diffs vs the last read
  // snapshot, since per-vote timestamps don't exist in local mode.
  const [threads, setThreads] = useState<Map<string, Comment[]>>(new Map());
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [voteBaseline, setVoteBaseline] = useState<Record<string, number>>({});
  const [collabBaseline, setCollabBaseline] = useState<string[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [seenAt, setSeenAt] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) {
      setReadIds([]);
      setVoteBaseline({});
      setCollabBaseline([]);
      setDismissedIds([]);
      setSeenAt({});
      prevUnreadCount.current = null;
      return;
    }
    const stored = loadNotificationState(user.id);
    setReadIds(stored.readIds);
    setVoteBaseline(stored.voteBaseline);
    setCollabBaseline(stored.collabBaseline);
    setDismissedIds(stored.dismissedIds);
    setSeenAt(stored.seenAt);
  }, [user?.id]);

  const scanApps = useMemo(() => {
    if (!user) return [];
    const mine = fullApps.filter((a) =>
      a.creatorId ? a.creatorId === user.id : a.creator.toLowerCase() === user.name.toLowerCase(),
    );
    const mineIds = new Set(mine.map((a) => a.id));
    return [...mine, ...fullApps.filter((a) => !mineIds.has(a.id)).slice(0, NOTIF_SCAN_APP_LIMIT)];
  }, [fullApps, user]);

  const scanKey = useMemo(() => scanApps.map((a) => a.id).join(","), [scanApps]);

  useEffect(() => {
    if (!user || scanApps.length === 0) {
      setThreads(new Map());
      setThreadsLoading(false);
      return;
    }
    let cancelled = false;
    setThreadsLoading(true);
    void (async () => {
      const entries = await Promise.all(
        scanApps.map(async (app): Promise<[string, Comment[]]> => {
          try {
            return [app.id, await getAppRepo().listComments(app.id, user.id)];
          } catch {
            return [app.id, []];
          }
        }),
      );
      if (!cancelled) {
        setThreads(new Map(entries));
        setThreadsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, scanKey, pollTick]);

  // Project ids currently tagging me (id or profile-name match). Drives both
  // the builder and the snapshot cleanup below.
  const currentlyTagged = useMemo(() => {
    if (!user) return [];
    return fullApps.filter((app) => isTaggedCollaborator(app, user, profiles)).map((app) => app.id);
  }, [user, fullApps, profiles]);
  const taggedKey = useMemo(() => [...currentlyTagged].sort().join(","), [currentlyTagged]);

  const notifications: NotificationItem[] = useMemo(() => {
    if (!user) return [];
    // No stored baseline yet (first run): treat current counts as seen so
    // old votes don't surface as fake "new" notifications.
    const baseline =
      Object.keys(voteBaseline).length > 0 ? voteBaseline : currentVoteBaseline(fullApps, user);
    return buildNotifications({
      user,
      apps: fullApps,
      threads,
      milestones,
      baseline,
      collabBaseline,
      profiles,
      arrivalAt: seenAt,
    });
  }, [user, fullApps, threads, milestones, voteBaseline, collabBaseline, profiles, seenAt]);

  // Single snapshot-sync writer (one effect = no lost updates between
  // competing saves). Converges — reruns are no-ops. It:
  // - stamps first-seen arrivals keyed by content version, so fresh news —
  //   including edits to already-listed items — sorts to the very top
  //   (pruned to the newest 400, always keeping currently listed keys);
  // - marks content-changed items unread again (unless explicitly deleted),
  //   so an edit resurfaces even after a mark-read;
  // - forgets cleared conditions so renewed activity notifies as new again:
  //   untagged projects leave the baseline, read receipts, and dismissals;
  //   vote items whose gain drained to zero leave the dismissals.
  // Skipped until apps finish loading: on fresh login fullApps is briefly
  // empty, and pruning against that empty world would wipe read receipts
  // and baselines — resurrecting everything already read on every login.
  useEffect(() => {
    if (!user || appsLoading || appsError) return;
    const missing = notifications.filter((n) => seenAt[arrivalKeyOf(n)] === undefined);
    let nextSeen = seenAt;
    if (missing.length > 0 || Object.keys(seenAt).length > 400) {
      const at = new Date().toISOString();
      nextSeen = { ...seenAt };
      for (const n of missing) nextSeen[arrivalKeyOf(n)] = at;
      if (Object.keys(nextSeen).length > 400) {
        const keep = new Set(notifications.map((n) => arrivalKeyOf(n)));
        const rest = Object.entries(nextSeen)
          .filter(([id]) => !keep.has(id))
          .sort(([, a], [, b]) => (a < b ? 1 : a > b ? -1 : 0));
        for (const [id] of rest.slice(0, Object.keys(nextSeen).length - 400)) {
          delete nextSeen[id];
        }
      }
    }
    const current = new Set(taggedKey ? taggedKey.split(",") : []);
    const votesById = new Map(fullApps.map((a) => [a.id, a.votes]));
    const voteGained = (appId: string) => {
      const votes = votesById.get(appId);
      if (votes === undefined) return 0;
      const before = typeof voteBaseline[appId] === "number" ? voteBaseline[appId] : votes;
      return votes - before;
    };
    const droppedCollab = (id: string) => id.startsWith("collab:") && !current.has(id.slice(7));
    const drainedVote = (id: string) => id.startsWith("vote:") && voteGained(id.slice(5)) <= 0;
    const nextBaseline = collabBaseline.filter((id) => current.has(id));
    // A new content version is new information: unread it again, unless the
    // user explicitly deleted that item.
    const dismissedSet = new Set(dismissedIds);
    const refreshedIds = new Set(missing.filter((n) => !dismissedSet.has(n.id)).map((n) => n.id));
    const nextReadIds = readIds.filter((id) => !droppedCollab(id) && !refreshedIds.has(id));
    const nextDismissed = dismissedIds.filter((id) => !droppedCollab(id) && !drainedVote(id));
    // Stamps are write-once (never rewritten), so key-set comparison is exact.
    const nextSeenKeys = Object.keys(nextSeen);
    const seenSame =
      nextSeenKeys.length === Object.keys(seenAt).length &&
      nextSeenKeys.every((k) => seenAt[k] === nextSeen[k]);
    if (
      seenSame &&
      nextBaseline.length === collabBaseline.length &&
      nextReadIds.length === readIds.length &&
      nextDismissed.length === dismissedIds.length
    ) {
      return;
    }
    setSeenAt(nextSeen);
    setCollabBaseline(nextBaseline);
    setReadIds(nextReadIds);
    setDismissedIds(nextDismissed);
    saveNotificationState(user.id, {
      readIds: nextReadIds,
      voteBaseline,
      collabBaseline: nextBaseline,
      dismissedIds: nextDismissed,
      seenAt: nextSeen,
    });
  }, [
    user?.id,
    appsLoading,
    appsError,
    notifications,
    taggedKey,
    fullApps,
    voteBaseline,
    seenAt,
    readIds,
    collabBaseline,
    dismissedIds,
  ]);

  // Deleted (dismissed) items leave the visible list. Event ids stay gone
  // (new events get new ids); vote/collab ids resurface only when their
  // condition renews, via the snapshot-sync effect above.
  const dismissed = useMemo(() => new Set(dismissedIds), [dismissedIds]);
  const visibleItems = useMemo(
    () => notifications.filter((n) => !dismissed.has(n.id)),
    [notifications, dismissed],
  );

  const unreadIds = useMemo(
    () => new Set(visibleItems.filter((n) => !readIds.includes(n.id)).map((n) => n.id)),
    [visibleItems, readIds],
  );

  // Chime when new notifications arrive. The first snapshot is silent so a
  // full inbox doesn't blast on page load (and pre-interaction playback,
  // which browsers block, is swallowed by the sound helper anyway).
  // Reset on account switch in the user-load effect above so a fresh login
  // with a full inbox doesn't chime against the previous account's count.
  const prevUnreadCount = useRef<number | null>(null);
  useEffect(() => {
    const count = unreadIds.size;
    if (prevUnreadCount.current === null) {
      prevUnreadCount.current = count;
      return;
    }
    if (count > prevUnreadCount.current) playNotificationSound();
    prevUnreadCount.current = count;
  }, [unreadIds]);

  const markAllNotificationsRead = useCallback(() => {
    if (!user) return;
    const next = {
      readIds: [...readIds, ...notifications.map((n) => n.id)],
      voteBaseline: currentVoteBaseline(fullApps, user),
      collabBaseline: currentlyTagged,
      dismissedIds,
      seenAt,
    };
    setReadIds(next.readIds);
    setVoteBaseline(next.voteBaseline);
    setCollabBaseline(next.collabBaseline);
    saveNotificationState(user.id, next);
  }, [user, readIds, notifications, fullApps, currentlyTagged, dismissedIds, seenAt]);

  const markNotificationRead = useCallback(
    (id: string) => {
      if (!user || readIds.includes(id)) return;
      // Preserve the snapshots — omitting them would wipe them on save.
      const next = {
        readIds: [...readIds, id],
        voteBaseline,
        collabBaseline,
        dismissedIds,
        seenAt,
      };
      setReadIds(next.readIds);
      saveNotificationState(user.id, next);
    },
    [user, readIds, voteBaseline, collabBaseline, dismissedIds, seenAt],
  );

  // Delete all: hide every visible item and snapshot the state-kind
  // conditions (votes, tags) so the box is truly empty until genuinely new
  // activity arrives. Event items (comments, projects, updates) stay gone —
  // future events arrive under new ids.
  const deleteAllNotifications = useCallback(() => {
    if (!user) return;
    const next = {
      readIds: [...readIds, ...visibleItems.map((n) => n.id)],
      voteBaseline: currentVoteBaseline(fullApps, user),
      collabBaseline: currentlyTagged,
      dismissedIds: [...dismissedIds, ...visibleItems.map((n) => n.id)],
      seenAt,
    };
    setReadIds(next.readIds);
    setVoteBaseline(next.voteBaseline);
    setCollabBaseline(next.collabBaseline);
    setDismissedIds(next.dismissedIds);
    saveNotificationState(user.id, next);
  }, [user, readIds, visibleItems, fullApps, currentlyTagged, dismissedIds, seenAt]);

  const openCommunity = useCallback(() => {
    window.history.pushState({}, "", "/community");
    setView("community");
    setSelectedProfileId(null);
    setSelectedAppId(null);
    setProjectEdit(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const logout = async () => {
    window.history.replaceState({}, "", "/");
    await signout();
  };
  const [confirmLogout, setConfirmLogout] = useState(false);

  useEffect(() => {
    if (!confirmLogout) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConfirmLogout(false);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [confirmLogout]);
  const goTab = (
    event: React.MouseEvent<HTMLAnchorElement>,
    nextView: Exclude<StoreView, "profile" | "project">,
  ) => {
    event.preventDefault();
    window.history.pushState({}, "", routeForView[nextView]);
    setView(nextView);
    setSelectedProfileId(null);
    setSelectedAppId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openProfile = useCallback((profileId: string) => {
    const path = profileId === "__me__" ? "/profile" : `/builders/${encodeURIComponent(profileId)}`;
    window.history.pushState({}, "", path);
    setSelectedProfileId(profileId);
    setSelectedAppId(null);
    setView("profile");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  const openMyProfile = useCallback(
    (e?: React.MouseEvent) => {
      e?.preventDefault();
      if (!user) return;
      window.history.pushState({}, "", "/profile");
      setSelectedProfileId(user.id);
      setView("profile");
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [user],
  );
  const openAppFromProfile = useCallback((appId: string) => {
    window.history.pushState({}, "", `/apps/${encodeURIComponent(appId)}`);
    setView("project");
    setSelectedProfileId(null);
    setSelectedAppId(appId);
    setProjectEdit(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  const openApp = useCallback((appId: string, edit = false) => {
    window.history.pushState({}, "", `/apps/${encodeURIComponent(appId)}`);
    setView("project");
    setSelectedProfileId(null);
    setSelectedAppId(appId);
    setProjectEdit(edit);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  const navClass = (item: Exclude<StoreView, "profile" | "project">) =>
    `flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 py-0 text-center text-xs font-black leading-tight lg:w-full lg:flex-row lg:justify-start lg:gap-3 lg:px-4 lg:py-3 lg:text-left lg:text-base ${view === item ? "border-2 border-ink bg-yellow text-ink shadow-[2px_2px_0_var(--color-ink)]" : "hover:bg-surface/15"}`;

  const goPath = (path: string, nextView: StoreView) => {
    window.history.pushState({}, "", path);
    setView(nextView);
    setSelectedProfileId(null);
    setSelectedAppId(null);
    setProjectEdit(false);
    window.scrollTo({ top: 0 });
  };

  type Crumb = { label: string; current?: boolean; go?: () => void };
  const profileForCrumb =
    selectedProfileId === "__me__" || (user && selectedProfileId === user.id)
      ? (myProfile ?? profiles.find((p) => user && p.id === user.id))
      : profiles.find((p) => p.id === selectedProfileId);
  const appForCrumb =
    fullApps.find((a) => a.id === selectedAppId) ?? apps.find((a) => a.id === selectedAppId);
  const crumbs: Crumb[] = (() => {
    if (view === "discover") return [{ label: "store", current: true }];
    if (view === "builders")
      return [
        { label: "store", go: () => goPath("/store", "discover") },
        { label: "builders", current: true },
      ];
    if (view === "community")
      return [
        { label: "store", go: () => goPath("/store", "discover") },
        { label: "community", current: true },
      ];
    if (view === "leaderboard")
      return [
        { label: "store", go: () => goPath("/store", "discover") },
        { label: "leaderboard", current: true },
      ];
    if (view === "settings")
      return [
        { label: "store", go: () => goPath("/store", "discover") },
        { label: "settings", current: true },
      ];
    if (view === "profile")
      return [
        { label: "store", go: () => goPath("/store", "discover") },
        { label: "builders", go: () => goPath("/builders", "builders") },
        { label: profileForCrumb?.name ?? "profile", current: true },
      ];
    return [
      { label: "store", go: () => goPath("/store", "discover") },
      { label: "apps", go: () => goPath("/store", "discover") },
      { label: appForCrumb?.title ?? "project", current: true },
    ];
  })();

  const [votePending, setVotePending] = useState<Set<string>>(new Set());

  const vote = async (id: string) => {
    if (!user || votePending.has(id)) return;
    setVotePending((prev) => new Set(prev).add(id));
    const previous = apps;
    const previousFull = fullApps;
    const optimistic = (app: AppItem) =>
      app.id === id
        ? {
            ...app,
            votes: Math.max(0, app.votes + (app.viewerHasVoted ? -1 : 1)),
            viewerHasVoted: !app.viewerHasVoted,
          }
        : app;
    setApps((items) => items.map(optimistic));
    setFullApps((items) => items.map(optimistic));
    try {
      const updated = await getAppRepo().toggleVote(id, user.id);
      setApps((items) => items.map((app) => (app.id === id ? updated : app)));
      setFullApps((items) => items.map((app) => (app.id === id ? updated : app)));
      playVoteSound();
    } catch {
      setApps(previous);
      setFullApps(previousFull);
    } finally {
      setVotePending((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !title.trim() || !desc.trim() || submitting || imageBusy) return;
    if (docs.trim().length > 50000) {
      setSubmitError(
        "This documentation exceeds the 50,000-character project limit. Download it or shorten it before publishing.",
      );
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const created = await getAppRepo().createApp(
        {
          title: title.trim(),
          description: desc.trim(),
          url: url.trim() ? url.trim() : undefined,
          repoUrl: repoUrl.trim() ? repoUrl.trim() : undefined,
          collaborators: [...new Set([...collabIds, ...extractMentionIds(desc, profiles)])],
          category: categoryInput,
          screenshots: screenshots.length ? screenshots : undefined,
          docs: docs.trim() ? docs.trim() : undefined,
        },
        user,
      );
      setApps((items) => [created, ...items]);
      setFullApps((items) => [created, ...items]);
      // Arm the tag for every tagged developer (except me): their next load
      // notifies as new, even across remove → re-add edit cycles.
      for (const id of created.collaborators ?? []) {
        if (id !== user.id) bumpCollabTag(id, created.id);
      }
      resetForm();
      setShowForm(false);
      setCategory("All");
      setQuery("");
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Could not publish project.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    repositoryRequest.current?.abort();
    repositoryRequest.current = null;
    setTitle("");
    setDesc("");
    setCollabIds([]);
    setUrl("");
    setRepoUrl("");
    setCategoryInput("Productivity");
    setScreenshots([]);
    setImgError(null);
    setDocs("");
    setDocsTab("write");
    setDocsPreviewReturnTab("write");
    setDocsFile(null);
    setRepositoryFiles([]);
    setSelectedRepositoryFiles([]);
    setRepositoryFilesLoading(false);
    setRepositoryFilesImporting(false);
    setRepositoryFilesError(null);
  };
  const pickImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setImageBusy(true);
    setImgError(null);
    try {
      const room = 3 - screenshots.length;
      const chosen = Array.from(files).slice(0, Math.max(0, room));
      const compressed = await Promise.all(chosen.map((f) => fileToThumbnailDataUrl(f)));
      setScreenshots((prev) => [...prev, ...compressed].slice(0, 3));
    } catch (e) {
      setImgError(e instanceof Error ? e.message : "Could not read those images.");
    } finally {
      setImageBusy(false);
    }
  };

  const readMdFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const { name, text } = await readMarkdownFile(file);
      setDocs(text);
      setDocsFile(name);
      setDocsPreviewReturnTab("upload");
      setDocsTab("preview");
      setSubmitError(null);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Could not read that file.");
    }
  };

  // Docs import source: the repo link, falling back to the app link for
  // older projects that stored a GitHub URL there.
  const docsRepoUrl = repoUrl.trim() || (isGitHubRepositoryUrl(url) ? url.trim() : "");

  const resetRepositoryFiles = () => {
    repositoryRequest.current?.abort();
    setRepositoryFiles([]);
    setSelectedRepositoryFiles([]);
    setRepositoryFilesLoading(false);
    setRepositoryFilesImporting(false);
    setRepositoryFilesError(null);
  };

  const loadRepositoryFiles = async () => {
    if (!isGitHubRepositoryUrl(docsRepoUrl)) {
      setRepositoryFilesError("Enter a public GitHub repository URL above first.");
      return;
    }

    repositoryRequest.current?.abort();
    const controller = new AbortController();
    repositoryRequest.current = controller;
    setRepositoryFilesLoading(true);
    setRepositoryFilesError(null);
    setRepositoryFiles([]);
    setSelectedRepositoryFiles([]);
    try {
      const paths = await listGitHubMarkdownFiles(docsRepoUrl, controller.signal);
      setRepositoryFiles(paths);
      const readme = paths.find((path) => /^readme\.md$/i.test(path));
      if (readme) setSelectedRepositoryFiles([readme]);
      if (!paths.length)
        setRepositoryFilesError("No Markdown files were found in this repository.");
    } catch (cause) {
      if (!controller.signal.aborted) {
        setRepositoryFilesError(
          cause instanceof Error ? cause.message : "Could not list repository Markdown files.",
        );
      }
    } finally {
      if (!controller.signal.aborted) setRepositoryFilesLoading(false);
    }
  };

  const importRepositoryFiles = async () => {
    if (!selectedRepositoryFiles.length || repositoryFilesImporting) return;

    repositoryRequest.current?.abort();
    const controller = new AbortController();
    repositoryRequest.current = controller;
    setRepositoryFilesImporting(true);
    setRepositoryFilesError(null);
    try {
      const files = await readGitHubMarkdownFiles(
        docsRepoUrl,
        selectedRepositoryFiles,
        controller.signal,
      );
      const combined = files.map(({ path, text }) => `# ${path}\n\n${text}`).join("\n\n---\n\n");
      setDocs(combined);
      setDocsFile(files.length === 1 ? files[0].path : `${files.length} repository Markdown files`);
      setDocsPreviewReturnTab("repository");
      setDocsTab("preview");
      setSubmitError(null);
    } catch (cause) {
      if (!controller.signal.aborted) {
        setRepositoryFilesError(
          cause instanceof Error ? cause.message : "Could not import repository Markdown files.",
        );
      }
    } finally {
      if (!controller.signal.aborted) setRepositoryFilesImporting(false);
    }
  };

  const downloadDocumentation = () => {
    const objectUrl = URL.createObjectURL(
      new Blob([docs], { type: "text/markdown;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = "documentation.md";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  };

  return (
    <div className="min-h-screen overflow-x-clip">
      <aside className="fixed inset-x-0 top-0 z-40 h-[85px] border-b-[3px] border-ink bg-purple p-5 text-surface lg:inset-y-0 lg:left-0 lg:right-auto lg:h-screen lg:w-[280px] lg:border-b-0 lg:border-r-[3px] lg:p-7">
        <div className="flex items-center justify-between">
          <Brand light />
          <div className="flex items-center gap-2 lg:hidden">
            {myProfile && (
              <button onClick={(e) => openMyProfile(e)} aria-label="View my profile">
                <Avatar
                  name={myProfile.name}
                  color={myProfile.color}
                  imageUrl={myProfile.imageUrl}
                  size="sm"
                  className="border-surface!"
                />
              </button>
            )}
            <button
              onClick={() => setConfirmLogout(true)}
              aria-label="Sign out"
              className="rounded-lg border-2 border-surface p-2"
            >
              <SignOut size={20} weight="bold" />
            </button>
          </div>
        </div>
        <nav
          className="fixed inset-x-0 bottom-0 z-50 grid h-18 grid-cols-6 gap-1 border-t-2 border-ink bg-purple p-2 sm:gap-2 lg:static lg:mt-12 lg:block lg:h-auto lg:space-y-2 lg:border-0 lg:bg-transparent lg:p-0 lg:pr-1"
          aria-label="Main navigation"
        >
          <a
            href="/store"
            onClick={(event) => goTab(event, "discover")}
            className={navClass("discover")}
          >
            <MagnifyingGlass size={21} weight="duotone" />
            Discover
          </a>
          <a
            href="/builders"
            onClick={(event) => goTab(event, "builders")}
            className={navClass("builders")}
          >
            <UsersThree size={22} weight="duotone" />
            <span className="lg:hidden">Devs</span>
            <span className="hidden lg:inline">Developers</span>
          </a>
          <a
            href="/community"
            onClick={(event) => goTab(event, "community")}
            className={navClass("community")}
          >
            <ChatCircleDots size={22} weight="duotone" />
            <span className="lg:hidden">Wall</span>
            <span className="hidden lg:inline">Community</span>
          </a>
          <a
            href="/leaderboard"
            onClick={(event) => goTab(event, "leaderboard")}
            className={navClass("leaderboard")}
          >
            <Trophy size={22} weight="duotone" />
            <span className="lg:hidden">Board</span>
            <span className="hidden lg:inline">Leaderboard</span>
          </a>
          <a
            href="/about"
            className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 py-0 text-center text-xs font-black leading-tight hover:bg-surface/15 lg:w-full lg:flex-row lg:justify-start lg:gap-3 lg:px-4 lg:py-3 lg:text-left lg:text-base"
          >
            <Info size={22} weight="duotone" />
            About
          </a>
          <a
            href="/settings"
            onClick={(event) => goTab(event, "settings")}
            className={navClass("settings")}
          >
            <Gear size={22} weight="duotone" />
            <span className="lg:hidden">Setup</span>
            <span className="hidden lg:inline">Settings</span>
          </a>
          {myProfile && (
            <button
              onClick={(e) => openMyProfile(e)}
              aria-current={view === "profile" ? "page" : undefined}
              className={`hidden w-full items-center justify-start gap-3 rounded-lg border-2 border-ink px-4 py-3 text-left text-base font-black leading-tight shadow-[2px_2px_0_var(--color-ink)] lg:flex ${view === "profile" ? "bg-yellow text-ink" : "bg-surface text-ink hover:bg-cream"}`}
            >
              <Avatar
                name={myProfile.name}
                color={myProfile.color}
                imageUrl={myProfile.imageUrl}
                size="md"
                className="!border-ink"
              />
              <span className="min-w-0">
                <span className="block truncate">
                  {myProfile.name}
                  {trophies.get(myProfile.id) !== undefined && (
                    <TrophyMark place={trophies.get(myProfile.id) as 1 | 2 | 3} size={18} />
                  )}
                </span>
                <span className="flex items-center gap-1 text-xs font-bold opacity-90">
                  <UserIcon size={14} weight="bold" /> My profile
                </span>
              </span>
            </button>
          )}
        </nav>
        <div className="mt-12 hidden lg:block">
          <div className="rounded-lg border-[3px] border-ink bg-mint p-4 text-ink shadow-[4px_4px_0_var(--color-ink)]">
            <UsersThree size={30} weight="duotone" />
            <p className="mt-2 font-black">Student projects, shared openly</p>
            <p className="mt-1 text-xs font-bold leading-5">
              Find collaborators, share progress, and exchange useful feedback.
            </p>
          </div>
          <button
            onClick={() => setConfirmLogout(true)}
            className="mt-7 flex items-center gap-2 text-sm font-black underline decoration-2 underline-offset-4"
          >
            <SignOut size={19} weight="bold" />
            Sign out
          </button>
        </div>
      </aside>

      {confirmLogout &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Confirm sign out"
            onClick={() => setConfirmLogout(false)}
            className="fixed inset-0 z-100 flex items-center justify-center overflow-y-auto bg-ink/80 p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="toon-card my-auto w-full max-w-sm rounded-lg bg-surface p-6 text-center"
            >
              <SignOut size={28} weight="duotone" className="mx-auto" />
              <h2 className="mt-3 text-xl font-black">Sign out?</h2>
              <p className="mt-1 text-sm font-bold text-muted">Are you sure you want to log out?</p>
              <div className="mt-5 flex justify-center gap-3">
                <Button
                  variant="surface"
                  size="small"
                  onClick={() => setConfirmLogout(false)}
                  autoFocus
                >
                  Cancel
                </Button>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => {
                    setConfirmLogout(false);
                    void logout();
                  }}
                >
                  Yes, sign out
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      <div className="min-w-0 px-5 pb-23 pt-26.25 sm:px-8 sm:pb-25 sm:pt-29.25 lg:ml-70 lg:p-10">
        <nav
          aria-label="Breadcrumb"
          className="sticky top-23.25 z-30 mx-auto mb-5 max-w-6xl overflow-x-auto rounded-xl border-[3px] border-ink bg-surface/80 px-3 py-2 font-mono text-sm shadow-[3px_3px_0_var(--color-ink)] backdrop-blur-md lg:top-4"
        >
          <ol className="flex min-w-max items-center gap-1">
            {crumbs.map((c, i) => (
              <li key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1">
                {i > 0 && (
                  <span aria-hidden="true" className="font-black text-muted">
                    \
                  </span>
                )}
                {c.current || !c.go ? (
                  <span
                    aria-current={c.current ? "page" : undefined}
                    title={c.label}
                    className={`max-w-45 truncate px-1.5 py-0.5 font-black ${c.current ? "rounded-md border-2 border-ink bg-yellow" : ""}`}
                  >
                    {c.label}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={c.go}
                    title={`Go to ${c.label}`}
                    className="max-w-[180px] truncate rounded-md px-1.5 py-0.5 font-bold text-purple hover:bg-cream hover:underline"
                  >
                    {c.label}
                  </button>
                )}
              </li>
            ))}
          </ol>
        </nav>
        <header id="discover" className="mx-auto max-w-6xl scroll-mt-5">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="ink-stamp bg-surface">{copyForView[view].stamp}</p>
              <h1 className="mt-4 text-3xl font-black sm:text-4xl">{copyForView[view].title}</h1>
              <p className="mt-3 max-w-2xl text-muted">{copyForView[view].description}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {user && (
                <NotificationBell
                  items={visibleItems}
                  unreadIds={unreadIds}
                  arrivalAt={seenAt}
                  loading={threadsLoading}
                  onOpenApp={(appId) => openApp(appId)}
                  onOpenCommunity={openCommunity}
                  onMarkAllRead={markAllNotificationsRead}
                  onMarkRead={markNotificationRead}
                  onDeleteAll={deleteAllNotifications}
                />
              )}
              {view !== "profile" && view !== "project" && view !== "settings" && (
                <Button variant="secondary" onClick={() => setShowForm((open) => !open)}>
                  {showForm ? <X size={20} weight="bold" /> : <Plus size={20} weight="bold" />}
                  {showForm ? "Close" : "Submit a project"}
                </Button>
              )}
            </div>
          </div>
          {view === "discover" && (
            <label className="relative mt-8 block">
              <span className="sr-only">Search student projects</span>
              <MagnifyingGlass
                size={23}
                weight="bold"
                className="absolute left-5 top-1/2 -translate-y-1/2"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="toon-input py-4 pl-14"
                placeholder="Search projects, descriptions, or developers"
              />
            </label>
          )}
        </header>

        <ErrorBoundary name={view} key={view}>
          <div className="mx-auto mt-9 max-w-6xl">
            {showForm && view !== "profile" && view !== "project" && view !== "settings" && (
              <form
                ref={submitFormRef}
                onSubmit={(e) => void submit(e)}
                className="toon-card paper-note mb-10 grid scroll-mt-28 gap-5 rounded-lg bg-sky p-6 pt-10 sm:grid-cols-2"
              >
                <div className="sm:col-span-2">
                  <RocketLaunch size={32} weight="duotone" />
                  <h2 className="mt-2 text-2xl font-black">Submit a project</h2>
                  <p className="text-body">Add a concise description and a link to your project.</p>
                </div>
                <label>
                  <span className="toon-label">Project name</span>
                  <input
                    className="toon-input"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    required
                    placeholder="Project name"
                  />
                </label>
                <label>
                  <span className="toon-label">
                    What does it do? (type @ to mention developers)
                  </span>
                  <MentionInput
                    value={desc}
                    onChange={setDesc}
                    profiles={profiles}
                    required
                    placeholder="One clear sentence — @ a collaborator"
                  />
                </label>
                <div className="sm:col-span-2">
                  <span className="toon-label">Collaborators (optional)</span>
                  <CollaboratorPicker
                    profiles={profiles}
                    selected={collabIds}
                    onChange={setCollabIds}
                  />
                </div>
                <label>
                  <span className="toon-label">Category</span>
                  <select
                    className="toon-input"
                    value={categoryInput}
                    onChange={(event) => setCategoryInput(event.target.value as Category)}
                  >
                    <option value="Education">Education</option>
                    <option value="Productivity">Productivity</option>
                    <option value="Games">Games</option>
                    <option value="Creative">Creative</option>
                  </select>
                </label>
                <label>
                  <span className="toon-label">App link</span>
                  <span className="relative block">
                    <LinkSimple
                      size={21}
                      weight="bold"
                      className="absolute left-4 top-1/2 -translate-y-1/2"
                    />
                    <input
                      className="toon-input pl-12"
                      type="url"
                      value={url}
                      onChange={(event) => {
                        setUrl(event.target.value);
                        resetRepositoryFiles();
                      }}
                      required
                      placeholder="https://project.example"
                      aria-describedby="app-link-help"
                    />
                  </span>
                  <span id="app-link-help" className="mt-2 block text-xs text-body">
                    The live demo or project page behind the Open app button.
                  </span>
                </label>
                <label>
                  <span className="toon-label">GitHub project repo link (optional)</span>
                  <span className="relative block">
                    <LinkSimple
                      size={21}
                      weight="bold"
                      className="absolute left-4 top-1/2 -translate-y-1/2"
                    />
                    <input
                      className="toon-input pl-12"
                      type="url"
                      value={repoUrl}
                      onChange={(event) => {
                        setRepoUrl(event.target.value);
                        resetRepositoryFiles();
                      }}
                      placeholder="https://github.com/you/project"
                      aria-describedby="repo-link-help"
                    />
                  </span>
                  <span id="repo-link-help" className="mt-2 block text-xs text-body">
                    Only used to import documentation. Never shown on the Open app button.
                  </span>
                </label>
                <div className="sm:col-span-2">
                  <span className="toon-label">Thumbnails (up to 3, first is the cover)</span>
                  <ButtonLabel variant="surface" size="small" className="cursor-pointer">
                    <Images size={20} weight="duotone" />
                    {imageBusy
                      ? "Processing…"
                      : screenshots.length
                        ? "Add more"
                        : "Choose from gallery"}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="sr-only"
                      disabled={imageBusy || screenshots.length >= 3}
                      onChange={(e) => {
                        void pickImages(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </ButtonLabel>
                  {imgError && (
                    <p role="alert" className="mt-2 text-sm font-bold">
                      {imgError}
                    </p>
                  )}
                  {screenshots.length > 0 && (
                    <div className="mt-3 grid grid-cols-3 gap-3">
                      {screenshots.map((src, i) => (
                        <div key={src.slice(0, 32) + i} className="relative">
                          <img
                            src={src}
                            alt={`Upload preview ${i + 1}`}
                            className="h-24 w-full rounded-xl border-[3px] border-ink object-cover"
                          />
                          {i === 0 && (
                            <span className="absolute left-2 top-2 rounded-full border-2 border-ink bg-yellow px-2 py-0.5 text-[10px] font-black">
                              COVER
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setScreenshots((prev) => prev.filter((_, j) => j !== i))}
                            aria-label={`Remove image ${i + 1}`}
                            className="absolute right-2 top-2 rounded-full border-2 border-ink bg-surface p-1"
                          >
                            <X size={14} weight="bold" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <span className="mt-2 block text-xs text-body">
                    Any photo from your gallery (iPhone HEIC not yet supported), compressed
                    on-device. First image becomes the card cover.
                  </span>
                </div>
                <div className="sm:col-span-2">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    {(["write", "upload", "repository"] as const).map((tab) => (
                      <Button
                        key={tab}
                        variant="outline-flat"
                        size="small"
                        type="button"
                        onClick={() => {
                          setDocsPreviewReturnTab(tab);
                          setDocsTab(tab);
                        }}
                        aria-pressed={docsTab === tab}
                        className="capitalize"
                      >
                        {tab === "upload"
                          ? "Upload .md"
                          : tab === "repository"
                            ? "GitHub repository"
                            : tab}
                      </Button>
                    ))}
                    <Button
                      variant="outline-flat"
                      size="small"
                      type="button"
                      onClick={() => {
                        if (docsTab === "preview") setDocsTab(docsPreviewReturnTab);
                        else {
                          setDocsPreviewReturnTab(docsTab);
                          setDocsTab("preview");
                        }
                      }}
                      aria-pressed={docsTab === "preview"}
                      className="ml-auto"
                    >
                      {docsTab === "preview" ? (
                        <>
                          <PencilSimple size={16} weight="bold" /> Edit
                        </>
                      ) : (
                        <>
                          <Eye size={16} weight="bold" /> Preview
                        </>
                      )}
                    </Button>
                  </div>
                  {docsTab === "write" && (
                    <MarkdownTextarea
                      className="min-h-24"
                      value={docs}
                      onChange={(event) => {
                        setDocs(event.target.value);
                        setDocsFile(null);
                      }}
                      maxLength={50000}
                      placeholder={"# My project\n\nWhat it does, how to run it…"}
                    />
                  )}
                  {docsTab === "upload" && (
                    <div>
                      <ButtonLabel variant="surface" size="small" className="cursor-pointer">
                        <BookOpenText size={20} weight="duotone" />
                        Choose README.md
                        <input
                          type="file"
                          accept=".md,.markdown,.txt,text/markdown,text/plain"
                          className="sr-only"
                          onChange={(e) => {
                            void readMdFile(e.target.files?.[0]);
                            e.target.value = "";
                          }}
                        />
                      </ButtonLabel>
                      <span className="mt-2 block text-xs text-body">
                        Works with README.md or plain extensionless README files, like on GitHub.
                      </span>
                      {docsFile && (
                        <div className="mt-3 rounded-xl border-2 border-dashed border-divider p-3">
                          <p className="text-sm font-black">✓ {docsFile} loaded</p>
                          <p className="mt-1 text-sm font-bold text-muted">
                            {docs.length} chars —{" "}
                            <button
                              type="button"
                              onClick={() => setDocsTab("preview")}
                              className="underline decoration-2 underline-offset-4"
                            >
                              see the finished doc
                            </button>
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  {docsTab === "repository" && (
                    <div className="rounded-xl border-2 border-ink bg-surface p-4">
                      {!isGitHubRepositoryUrl(docsRepoUrl) ? (
                        <p role="status" className="text-sm font-bold text-body">
                          Provide your GitHub project repo link first — paste it in the repo link
                          field above, then come back here to choose Markdown files.
                        </p>
                      ) : (
                        <>
                          <p className="text-sm font-bold text-body">
                            Choose Markdown files from the public GitHub repository in your project
                            link.
                          </p>
                          <Button
                            variant="secondary"
                            size="small"
                            type="button"
                            onClick={() => void loadRepositoryFiles()}
                            disabled={repositoryFilesLoading || repositoryFilesImporting}
                            className="mt-3"
                          >
                            {repositoryFilesLoading
                              ? "Loading repository files…"
                              : "Load Markdown files"}
                          </Button>
                          {repositoryFilesError && (
                            <p role="alert" className="mt-3 text-sm font-bold text-ink">
                              {repositoryFilesError}
                            </p>
                          )}
                          {repositoryFiles.length > 0 && (
                            <>
                              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                                <p className="text-sm font-black">
                                  {selectedRepositoryFiles.length} of {repositoryFiles.length}{" "}
                                  selected
                                </p>
                                <label className="flex items-center gap-2 text-sm font-black">
                                  <input
                                    type="checkbox"
                                    checked={
                                      selectedRepositoryFiles.length === repositoryFiles.length
                                    }
                                    onChange={(event) =>
                                      setSelectedRepositoryFiles(
                                        event.target.checked ? repositoryFiles : [],
                                      )
                                    }
                                  />
                                  Select all
                                </label>
                              </div>
                              <div className="mt-2 max-h-64 space-y-1 overflow-y-auto rounded-lg border-2 border-divider p-2">
                                {repositoryFiles.map((path) => (
                                  <label
                                    key={path}
                                    className="flex items-start gap-2 rounded-md px-2 py-1.5 text-sm font-bold hover:bg-cream"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedRepositoryFiles.includes(path)}
                                      onChange={(event) =>
                                        setSelectedRepositoryFiles((selected) =>
                                          event.target.checked
                                            ? [...selected, path]
                                            : selected.filter((item) => item !== path),
                                        )
                                      }
                                      className="mt-1 shrink-0"
                                    />
                                    <span className="break-all">{path}</span>
                                  </label>
                                ))}
                              </div>
                              <Button
                                size="small"
                                type="button"
                                onClick={() => void importRepositoryFiles()}
                                disabled={
                                  !selectedRepositoryFiles.length || repositoryFilesImporting
                                }
                                className="mt-3"
                              >
                                {repositoryFilesImporting
                                  ? "Importing selected files…"
                                  : `Use ${selectedRepositoryFiles.length} selected file${selectedRepositoryFiles.length === 1 ? "" : "s"}`}
                              </Button>
                              <p className="mt-2 text-xs font-bold text-muted">
                                Selected files are combined into project documentation
                                (50,000-character limit).
                              </p>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  )}
                  {docsTab === "preview" && (
                    <div className="rounded-2xl border-[3px] border-ink bg-surface p-4">
                      {docsFile && docs.trim() && (
                        <p className="mb-3 text-xs font-black uppercase text-muted">
                          Preview of {docsFile}
                        </p>
                      )}
                      {docs.length > 50000 && (
                        <div
                          role="status"
                          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-ink bg-yellow/40 p-3"
                        >
                          <p className="text-sm font-bold">
                            This document is {docs.length.toLocaleString()} characters. It exceeds
                            the 50,000-character project limit, but you can still download it.
                          </p>
                          <Button
                            variant="surface"
                            size="small"
                            type="button"
                            onClick={downloadDocumentation}
                            className="shrink-0"
                          >
                            <DownloadSimple size={18} weight="bold" />
                            Download Markdown
                          </Button>
                        </div>
                      )}
                      {docs.trim() ? (
                        <PagedMarkdown text={docs} fadeTo="var(--color-surface)" />
                      ) : (
                        <p className="text-sm font-bold text-muted">
                          Nothing to preview yet — write some markdown or upload a README.
                        </p>
                      )}
                    </div>
                  )}
                </div>
                {submitError && (
                  <p role="alert" className="sm:col-span-2 text-sm font-bold text-ink">
                    {submitError}
                  </p>
                )}
                <Button
                  type="submit"
                  disabled={
                    submitting || imageBusy || repositoryFilesLoading || repositoryFilesImporting
                  }
                  className="sm:col-span-2 sm:justify-self-start"
                >
                  {submitting
                    ? "Publishing…"
                    : imageBusy
                      ? "Processing images…"
                      : repositoryFilesLoading || repositoryFilesImporting
                        ? "Loading documentation…"
                        : "Publish project"}{" "}
                  <ArrowRight size={20} weight="bold" />
                </Button>
              </form>
            )}

            {view === "project" && selectedAppId && (
              <section className="mt-2">
                <ProjectView
                  key={`${selectedAppId}:${projectEdit}`}
                  appId={selectedAppId}
                  currentUser={user ?? null}
                  profiles={profilesLookup}
                  startEditing={projectEdit}
                  onBack={() => {
                    window.history.pushState({}, "", "/store");
                    setView("discover");
                    setSelectedAppId(null);
                    setProjectEdit(false);
                  }}
                  onOpenProfile={openProfile}
                  trophies={trophies}
                  projectTrophies={projectTrophies}
                  onChanged={() => void loadApps()}
                  onDeleted={() => {
                    window.history.pushState({}, "", "/store");
                    setView("discover");
                    setSelectedAppId(null);
                    setProjectEdit(false);
                    void loadApps();
                  }}
                />
              </section>
            )}

            {view === "profile" && selectedProfileId && (
              <section className="mt-2">
                <ProfileView
                  key={selectedProfileId}
                  profileId={
                    selectedProfileId === "__me__" ? (user?.id ?? "__me__") : selectedProfileId
                  }
                  currentUser={user ?? null}
                  trophies={trophies}
                  projectTrophies={projectTrophies}
                  profiles={profilesLookup}
                  rankSummary={(() => {
                    const resolvedId =
                      selectedProfileId === "__me__" ? (user?.id ?? "__me__") : selectedProfileId;
                    const rank = rankedDevelopers.findIndex((r) => r.profile.id === resolvedId);
                    if (rank === -1) return undefined;
                    return {
                      rank: rank + 1,
                      points: rankedDevelopers[rank].points,
                      total: rankedDevelopers.length,
                    };
                  })()}
                  onBack={() => {
                    window.history.pushState({}, "", "/builders");
                    setView("builders");
                    setSelectedProfileId(null);
                  }}
                  onOpenApp={openAppFromProfile}
                  onOpenProfile={openProfile}
                  onClaimed={() => {
                    if (!user) return;
                    openProfile(user.id);
                    setProfileTick((t) => t + 1);
                    void loadApps();
                  }}
                  onProfileUpdated={() => setProfileTick((t) => t + 1)}
                />
              </section>
            )}

            {view === "discover" && (
              <section id="apps" className="mt-2 scroll-mt-6">
                {user &&
                  !fullApps.some((a) =>
                    a.creatorId ? a.creatorId === user.id : a.creator === user.name,
                  ) && (
                    <div className="toon-card paper-note mb-6 flex flex-wrap items-center gap-4 rounded-lg bg-mint p-6">
                      <RocketLaunch size={32} weight="duotone" className="shrink-0" />
                      <div className="min-w-0 flex-1">
                        <h3 className="text-xl font-black">You have not shared anything yet</h3>
                        <p className="mt-1 text-sm font-bold text-body">
                          Publish your first project to appear on the leaderboard.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setShowForm(true);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="toon-button shrink-0 rounded-2xl bg-purple px-5 py-2.5 text-sm text-surface"
                      >
                        <Plus size={18} weight="bold" /> Submit your first project
                      </button>
                    </div>
                  )}
                <div className="mb-5 border-t-2 border-dashed border-divider pt-6">
                  <p className="text-xs font-black uppercase text-purple">Catalog</p>
                  <h2 className="mt-1 text-2xl font-black">Student projects</h2>
                </div>
                <div className="mb-6 flex flex-wrap gap-2">
                  {categories.map(({ label, Icon }) => (
                    <Button
                      variant="outline-flat"
                      key={label}
                      onClick={() => setCategory(label)}
                      aria-pressed={category === label}
                    >
                      <Icon size={19} weight="duotone" />
                      {label}
                    </Button>
                  ))}
                </div>
                {appsLoading ? (
                  <p className="font-bold text-muted">Loading projects…</p>
                ) : appsError ? (
                  <div className="toon-card paper-note rounded-lg p-10 text-center">
                    <h3 className="mt-3 text-xl font-black">Could not load projects</h3>
                    <p className="font-bold text-muted">{appsError}</p>
                    <Button variant="secondary" onClick={() => void loadApps()} className="mt-5">
                      Retry
                    </Button>
                  </div>
                ) : apps.length ? (
                  <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {apps.map((app) => (
                      <AppCard
                        key={app.id}
                        app={app}
                        voted={Boolean(app.viewerHasVoted)}
                        onVote={(id) => void vote(id)}
                        user={user ?? null}
                        expanded={expandedId === app.id}
                        onToggle={(id) => setExpandedId((cur) => (cur === id ? null : id))}
                        onCommentAdded={(appId, count) => {
                          setApps((items) =>
                            items.map((a) => (a.id === appId ? { ...a, comments: count } : a)),
                          );
                          setFullApps((items) =>
                            items.map((a) => (a.id === appId ? { ...a, comments: count } : a)),
                          );
                        }}
                        profiles={profilesLookup}
                        trophies={trophies}
                        projectTrophies={projectTrophies}
                        onOpenProfile={openProfile}
                        onOpenApp={(id) => openApp(id)}
                        onEditApp={(id) => openApp(id, true)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="toon-card paper-note rounded-lg p-10 text-center">
                    <MagnifyingGlass size={36} className="mx-auto" />
                    <h3 className="mt-3 text-xl font-black">No projects found</h3>
                    <p className="font-bold text-muted">Adjust your search or category filter.</p>
                  </div>
                )}
              </section>
            )}

            {view === "builders" && (
              <section id="builders" className="mt-2 scroll-mt-6">
                <div className="mb-6">
                  <p className="text-xs font-black uppercase text-purple">Student contributors</p>
                  <h2 className="mt-1 text-2xl font-black">Developer profiles</h2>
                  <label className="relative mt-4 block max-w-md">
                    <span className="sr-only">Search developers</span>
                    <MagnifyingGlass
                      size={20}
                      weight="bold"
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-muted"
                    />
                    <input
                      value={devQuery}
                      onChange={(event) => setDevQuery(event.target.value)}
                      className="toon-input py-2.5 pl-11 text-sm"
                      placeholder="Search name or role…"
                    />
                  </label>
                </div>
                <div className="toon-card paper-note grid gap-x-6 gap-y-8 rounded-lg p-6 pt-10 sm:grid-cols-2 sm:p-8 sm:pt-12 lg:grid-cols-3">
                  {filteredProfiles.map((p) => {
                    const place = trophies.get(p.id);
                    return (
                      <article
                        key={p.id}
                        className={`min-w-0 ${place !== undefined ? "rounded-lg border-[3px] border-ink p-3" : ""}`}
                        style={
                          place === 1
                            ? { backgroundColor: "#F7DE6B" }
                            : place === 2
                              ? { backgroundColor: "#DDE3EA" }
                              : place === 3
                                ? { backgroundColor: "#EAC39E" }
                                : undefined
                        }
                      >
                        <div className="flex items-center gap-3">
                          <a
                            href={`/builders/${encodeURIComponent(p.id)}`}
                            onClick={(e) => {
                              e.preventDefault();
                              openProfile(p.id);
                            }}
                            aria-label={`View ${p.name}'s profile`}
                            className="shrink-0"
                          >
                            <Avatar name={p.name} color={p.color} imageUrl={p.imageUrl} size="md" />
                          </a>
                          <h3 className="min-w-0 flex-1 break-words text-lg font-black">
                            <a
                              href={`/builders/${encodeURIComponent(p.id)}`}
                              onClick={(e) => {
                                e.preventDefault();
                                openProfile(p.id);
                              }}
                              className="underline-offset-4 hover:underline"
                            >
                              {p.name}
                            </a>
                            {trophies.get(p.id) !== undefined && (
                              <TrophyMark place={trophies.get(p.id) as 1 | 2 | 3} />
                            )}
                          </h3>
                        </div>
                        <p className="mt-2 text-sm text-muted">{p.role}</p>
                        <p className="mt-3 text-xs font-black uppercase">
                          {countFor(p)} project{countFor(p) === 1 ? "" : "s"} shared
                        </p>
                      </article>
                    );
                  })}
                  {filteredProfiles.length === 0 && (
                    <p className="font-bold text-muted sm:col-span-2 lg:col-span-3">
                      No developers match “{devQuery.trim()}”.
                    </p>
                  )}
                </div>
              </section>
            )}

            {view === "community" && (
              <section id="activity" className="mt-2 scroll-mt-6">
                <div className="mb-6">
                  <p className="text-xs font-black uppercase text-purple">Builder progress</p>
                  <h2 className="mt-1 text-2xl font-black">Milestones wall</h2>
                  <p className="mt-2 max-w-2xl font-bold text-muted">
                    Ship an update on what you built, link the project, and cheer others on.
                  </p>
                </div>
                <div className="grid items-start gap-7 lg:grid-cols-[1fr_.7fr]">
                  <div className="min-w-0">
                    <form
                      onSubmit={(e) => void postMilestone(e)}
                      className="toon-card paper-note rounded-lg bg-sky p-6 pt-10"
                    >
                      <h3 className="text-xl font-black">Share an update</h3>
                      <label className="mt-4 block">
                        <span className="sr-only">What did you ship or learn?</span>
                        <textarea
                          value={mBody}
                          onChange={(e) => setMBody(e.target.value)}
                          maxLength={280}
                          required
                          placeholder="What did you ship or learn?…"
                          className="toon-input min-h-24"
                        />
                      </label>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <label className="min-w-0 flex-1">
                          <span className="sr-only">Link one of your projects (optional)</span>
                          <select
                            value={mAppId}
                            onChange={(e) => setMAppId(e.target.value)}
                            className="toon-input py-2 text-sm"
                          >
                            <option value="">No linked project</option>
                            {user &&
                              fullApps
                                .filter((a) =>
                                  a.creatorId ? a.creatorId === user.id : a.creator === user.name,
                                )
                                .map((a) => (
                                  <option key={a.id} value={a.id}>
                                    {a.title}
                                  </option>
                                ))}
                          </select>
                        </label>
                        <span className="text-xs font-black text-muted">{mBody.length}/280</span>
                        <Button
                          size="small"
                          type="submit"
                          disabled={mPosting || !mBody.trim()}
                          className="text-sm"
                        >
                          {mPosting ? "Posting…" : "Post update"}
                        </Button>
                      </div>
                      {mPostError && (
                        <p role="alert" className="mt-3 text-sm font-bold">
                          {mPostError}
                        </p>
                      )}
                    </form>

                    <label className="relative mt-6 block">
                      <span className="sr-only">Search updates</span>
                      <MagnifyingGlass
                        size={20}
                        weight="bold"
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-muted"
                      />
                      <input
                        value={msQuery}
                        onChange={(event) => setMsQuery(event.target.value)}
                        className="toon-input py-2.5 pl-11 text-sm"
                        placeholder="Search updates or builders…"
                      />
                    </label>

                    {milestonesLoading ? (
                      <p className="mt-6 font-bold text-muted">Loading updates…</p>
                    ) : milestonesError ? (
                      <div className="toon-card paper-note mt-6 rounded-lg p-10 text-center">
                        <h3 className="text-xl font-black">Could not load updates</h3>
                        <p className="font-bold text-muted">{milestonesError}</p>
                      </div>
                    ) : filteredMilestones.length ? (
                      <ul className="mt-6 space-y-4">
                        {filteredMilestones.map((m) => {
                          const p = profilesLookup.get(m.authorId);
                          const linked = m.appId
                            ? fullApps.find((a) => a.id === m.appId)
                            : undefined;
                          return (
                            <li key={m.id} className="toon-card rounded-lg bg-surface p-5">
                              <div className="flex items-center gap-3">
                                {p ? (
                                  <button
                                    onClick={() => openProfile(p.id)}
                                    aria-label={`View ${p.name}'s profile`}
                                    className="shrink-0"
                                  >
                                    <Avatar
                                      name={p.name}
                                      color={p.color}
                                      imageUrl={p.imageUrl}
                                      size="sm"
                                    />
                                  </button>
                                ) : (
                                  <Avatar name={m.authorName} color="sky" size="sm" />
                                )}
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-black">
                                    {p ? (
                                      <button
                                        onClick={() => openProfile(p.id)}
                                        className="underline decoration-2 underline-offset-4"
                                      >
                                        {m.authorName}
                                      </button>
                                    ) : (
                                      m.authorName
                                    )}
                                    {trophies.get(m.authorId) !== undefined && (
                                      <TrophyMark
                                        place={trophies.get(m.authorId) as 1 | 2 | 3}
                                        size={16}
                                      />
                                    )}
                                  </p>
                                  <p className="text-xs font-bold text-muted">
                                    {new Date(m.createdAt).toLocaleString()}
                                  </p>
                                </div>
                              </div>
                              <p className="mt-3 leading-7">{m.body}</p>
                              <div className="mt-3 flex flex-wrap items-center gap-3">
                                {linked && (
                                  <button
                                    onClick={() => openApp(linked.id)}
                                    className="rounded-md border-2 border-ink bg-cream px-2.5 py-1 text-xs font-black hover:bg-yellow"
                                  >
                                    View {linked.title}
                                    {projectTrophies.get(linked.id) !== undefined && (
                                      <TrophyMark
                                        place={projectTrophies.get(linked.id) as 1 | 2 | 3}
                                        size={14}
                                      />
                                    )}
                                  </button>
                                )}
                                <Button
                                  variant="vote"
                                  onClick={() => void cheer(m)}
                                  aria-pressed={Boolean(m.viewerHasCheered)}
                                  disabled={!user || cheerPending.has(m.id)}
                                  className={m.viewerHasCheered ? "" : "text-muted"}
                                >
                                  <HandsClapping
                                    size={18}
                                    weight={m.viewerHasCheered ? "fill" : "duotone"}
                                  />
                                  {m.cheers ?? 0}
                                  <span className="sr-only">
                                    {m.viewerHasCheered ? "Uncheer" : "Cheer this on"}
                                  </span>
                                </Button>
                                <button
                                  onClick={() => toggleThread(m.id)}
                                  aria-expanded={openThreads.has(m.id)}
                                  className="flex items-center gap-1 text-sm font-black text-muted"
                                >
                                  <ChatCircleDots size={18} weight="duotone" />
                                  {openThreads.has(m.id) ? "Hide replies" : "Reply"}
                                </button>
                              </div>
                              {openThreads.has(m.id) && (
                                <div className="mt-3 border-t-2 border-dashed border-divider pt-4">
                                  <Comments
                                    appId={`ms:${m.id}`}
                                    appTitle={`Update by ${m.authorName}`}
                                    currentUser={user ?? null}
                                    profiles={profilesLookup}
                                    trophies={trophies}
                                    onOpenProfile={openProfile}
                                  />
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="toon-card paper-note mt-6 rounded-lg p-10 text-center">
                        <h3 className="text-xl font-black">
                          {milestones.length ? "No matching updates" : "No updates yet"}
                        </h3>
                        <p className="font-bold text-muted">
                          {milestones.length
                            ? "Try a different search."
                            : "Be the first to share what you shipped."}
                        </p>
                      </div>
                    )}
                  </div>
                  <aside className="toon-card paper-note rounded-lg bg-yellow p-6 pt-10">
                    <Sparkle size={35} weight="duotone" />
                    <p className="mt-5 text-xs font-black uppercase">Community standard</p>
                    <h2 className="mt-2 text-2xl font-black">Share work. Give useful feedback.</h2>
                    <p className="mt-3 font-bold leading-7">
                      Keep feedback constructive, credit collaborators, and make space for ideas in
                      progress.
                    </p>
                  </aside>
                </div>
              </section>
            )}

            {view === "leaderboard" && (
              <section className="mt-2">
                <div className="mb-6">
                  <p className="text-xs font-black uppercase text-purple">
                    {boardTab === "developers"
                      ? "Rank points = total upvotes"
                      : "Ranked by project upvotes"}
                  </p>
                  <h2 className="mt-1 text-2xl font-black">
                    {boardTab === "developers" ? "Top developers" : "Top projects"}
                  </h2>
                  <div
                    className="mt-4 flex flex-wrap gap-2"
                    role="tablist"
                    aria-label="Leaderboard view"
                  >
                    {(["developers", "projects"] as const).map((tab) => (
                      <button
                        key={tab}
                        role="tab"
                        aria-selected={boardTab === tab}
                        onClick={() => setBoardTab(tab)}
                        className={`flex min-w-max items-center gap-2 rounded-md border-2 border-ink px-3 py-2 text-sm font-black capitalize ${boardTab === tab ? "bg-purple text-surface" : "bg-surface"}`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>
                {boardTab === "developers" ? (
                  rankedDevelopers.length ? (
                    <ol className="space-y-4">
                      {rankedDevelopers.map(({ profile: p, projects, points }, i) => (
                        <li
                          key={p.id}
                          className="toon-card flex items-center gap-4 rounded-lg bg-surface p-4 sm:p-5"
                          style={
                            i === 0
                              ? { backgroundColor: "#F7DE6B" }
                              : i === 1
                                ? { backgroundColor: "#DDE3EA" }
                                : i === 2
                                  ? { backgroundColor: "#EAC39E" }
                                  : undefined
                          }
                        >
                          <span
                            aria-label={`Rank ${i + 1}`}
                            className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border-[3px] border-ink text-base font-black ${i === 0 ? "bg-yellow" : i === 1 ? "bg-mint" : i === 2 ? "bg-pink" : "bg-cream"}`}
                          >
                            {i + 1}
                          </span>
                          <button
                            onClick={() => openProfile(p.id)}
                            aria-label={`View ${p.name}'s profile`}
                            className="shrink-0"
                          >
                            <Avatar name={p.name} color={p.color} imageUrl={p.imageUrl} size="md" />
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-lg font-black">
                              <button
                                onClick={() => openProfile(p.id)}
                                className="underline-offset-4 hover:underline"
                              >
                                {p.name}
                              </button>
                              {trophies.get(p.id) !== undefined && (
                                <TrophyMark place={trophies.get(p.id) as 1 | 2 | 3} />
                              )}
                            </p>
                            <p className="truncate text-sm font-bold text-muted">
                              {projects} {projects === 1 ? "project" : "projects"}
                            </p>
                          </div>
                          <p className="flex shrink-0 items-center gap-1.5 text-base font-black">
                            <Trophy
                              size={20}
                              weight="duotone"
                              className={i === 0 ? "text-purple" : "text-muted"}
                            />
                            {points}{" "}
                            <span className="text-xs uppercase text-muted">
                              {points === 1 ? "pt" : "pts"}
                            </span>
                          </p>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <div className="toon-card paper-note rounded-lg p-10 text-center">
                      <h3 className="text-xl font-black">No developers yet</h3>
                      <p className="font-bold text-muted">Check back once builders join.</p>
                    </div>
                  )
                ) : rankedProjects.length ? (
                  <ol className="space-y-4">
                    {rankedProjects.map((app, i) => {
                      const creator = app.creatorId
                        ? profilesLookup.get(app.creatorId)
                        : [...profilesLookup.values()].find(
                            (p) => p.name.toLowerCase() === app.creator.toLowerCase(),
                          );
                      return (
                        <li
                          key={app.id}
                          className="toon-card flex items-center gap-4 rounded-lg bg-surface p-4 sm:p-5"
                          style={
                            i === 0
                              ? { backgroundColor: "#F7DE6B" }
                              : i === 1
                                ? { backgroundColor: "#DDE3EA" }
                                : i === 2
                                  ? { backgroundColor: "#EAC39E" }
                                  : undefined
                          }
                        >
                          <span
                            aria-label={`Rank ${i + 1}`}
                            className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border-[3px] border-ink text-base font-black ${i === 0 ? "bg-yellow" : i === 1 ? "bg-mint" : i === 2 ? "bg-pink" : "bg-cream"}`}
                          >
                            {i + 1}
                          </span>
                          <button
                            onClick={() => openApp(app.id)}
                            aria-label={`Open ${app.title} details`}
                            className="min-w-0 flex-1 text-left"
                          >
                            <span className="block truncate text-lg font-black underline-offset-4 hover:underline">
                              {app.title}
                              {projectTrophies.get(app.id) !== undefined && (
                                <TrophyMark place={projectTrophies.get(app.id) as 1 | 2 | 3} />
                              )}
                            </span>
                            <span className="block truncate text-sm font-bold text-muted">
                              by {creator ? creator.name : app.creator}
                            </span>
                          </button>
                          <p className="flex shrink-0 items-center gap-1.5 text-base font-black">
                            <Heart
                              size={20}
                              weight="duotone"
                              className={i === 0 ? "text-vote" : "text-muted"}
                            />
                            {app.votes}{" "}
                            <span className="text-xs uppercase text-muted">
                              {app.votes === 1 ? "vote" : "votes"}
                            </span>
                          </p>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <div className="toon-card paper-note rounded-lg p-10 text-center">
                    <h3 className="text-xl font-black">No projects yet</h3>
                    <p className="font-bold text-muted">Check back once builders share work.</p>
                  </div>
                )}
              </section>
            )}

            {view === "settings" && (
              <section className="mt-2">
                <SettingsView profile={myProfile} onChanged={() => setProfileTick((t) => t + 1)} />
              </section>
            )}

            <footer className="mb-8 mt-12 border-t-2 border-dashed border-muted py-7 text-center text-sm font-bold text-muted">
              CodeCanvas is built together by the SPECS community.
            </footer>
          </div>
        </ErrorBoundary>
      </div>
    </div>
  );
}
