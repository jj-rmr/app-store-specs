import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpenText,
  ChatCircleDots,
  DownloadSimple,
  Eye,
  GameController,
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
import Avatar from "../components/Avatar";
import MarkdownFileViewer from "../components/MarkdownFileViewer";
import MarkdownTextarea from "../components/MarkdownTextarea";
import Markdown from "../components/Markdown";
import ProfileView from "../components/ProfileView";
import ProjectView from "../components/ProjectView";
import { Button, ButtonLabel } from "../components/Button";
import { getAppRepo, getProfileRepo } from "../data/factory";
import { indexProfiles } from "../data/profileLinks";
import { fileToThumbnailDataUrl } from "../utils/images";
import { extractMentionIds } from "../utils/mentions";
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
import type { AppItem, Category, CategoryFilter, Milestone, Profile } from "../data/types";

const categories: { label: CategoryFilter; Icon: typeof SquaresFour }[] = [
  { label: "All", Icon: SquaresFour },
  { label: "Education", Icon: GraduationCap },
  { label: "Productivity", Icon: Wrench },
  { label: "Games", Icon: GameController },
  { label: "Creative", Icon: Palette },
];

type StoreView = "discover" | "builders" | "community" | "leaderboard" | "profile" | "project";

const routeForView: Record<Exclude<StoreView, "profile" | "project">, string> = {
  discover: "/store",
  builders: "/builders",
  community: "/community",
  leaderboard: "/leaderboard",
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
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [milestonesLoading, setMilestonesLoading] = useState(true);
  const [milestonesError, setMilestonesError] = useState<string | null>(null);
  const [mBody, setMBody] = useState("");
  const [mAppId, setMAppId] = useState("");
  const [mPosting, setMPosting] = useState(false);
  const [mPostError, setMPostError] = useState<string | null>(null);
  const [cheerPending, setCheerPending] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("All");
  const [showForm, setShowForm] = useState(false);
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
  const rankedDevelopers = useMemo(
    () => rankDevelopers(profiles, fullApps),
    [profiles, fullApps],
  );

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
          setMyProfile(list.find((p) => p.id === user.id) ?? null);
        }
      } catch {
        if (!cancelled) setProfiles([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    setMilestonesLoading(true);
    setMilestonesError(null);
    getAppRepo()
      .listMilestones(user?.id)
      .then((items) => {
        if (!cancelled) setMilestones(items);
      })
      .catch((e) => {
        if (!cancelled) setMilestonesError(e instanceof Error ? e.message : "Could not load updates.");
      })
      .finally(() => {
        if (!cancelled) setMilestonesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

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

  const loadApps = useCallback(async () => {
    setAppsLoading(true);
    setAppsError(null);
    try {
      const [filtered, all] = await Promise.all([
        getAppRepo().listApps({ query, category, userId: user?.id }),
        getAppRepo().listApps({ limit: 200, userId: user?.id }),
      ]);
      setApps(filtered);
      setFullApps(all);
    } catch (e) {
      setAppsError(e instanceof Error ? e.message : "Could not load projects.");
    } finally {
      setAppsLoading(false);
    }
  }, [query, category, user?.id]);

  useEffect(() => {
    void loadApps();
  }, [loadApps]);

  const logout = async () => {
    window.history.replaceState({}, "", "/");
    await signout();
  };
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

  const vote = async (id: string) => {
    if (!user) return;
    const previous = apps;
    setApps((items) =>
      items.map((app) =>
        app.id === id
          ? {
              ...app,
              votes: Math.max(0, app.votes + (app.viewerHasVoted ? -1 : 1)),
              viewerHasVoted: !app.viewerHasVoted,
            }
          : app,
      ),
    );
    try {
      const updated = await getAppRepo().toggleVote(id, user.id);
      setApps((items) => items.map((app) => (app.id === id ? updated : app)));
    } catch {
      setApps(previous);
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
              onClick={() => void logout()}
              aria-label="Sign out"
              className="rounded-lg border-2 border-surface p-2"
            >
              <SignOut size={20} weight="bold" />
            </button>
          </div>
        </div>
        <nav
          className="fixed inset-x-0 bottom-0 z-50 grid h-18 grid-cols-5 gap-1 border-t-2 border-ink bg-purple p-2 sm:gap-2 lg:static lg:mt-12 lg:block lg:h-auto lg:space-y-2 lg:border-0 lg:bg-transparent lg:p-0 lg:pr-1"
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
            onClick={() => void logout()}
            className="mt-7 flex items-center gap-2 text-sm font-black underline decoration-2 underline-offset-4"
          >
            <SignOut size={19} weight="bold" />
            Sign out
          </button>
        </div>
      </aside>

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
            {view !== "profile" && view !== "project" && (
              <Button
                variant="secondary"
                onClick={() => setShowForm((open) => !open)}
              >
                {showForm ? <X size={20} weight="bold" /> : <Plus size={20} weight="bold" />}
                {showForm ? "Close" : "Submit a project"}
              </Button>
            )}
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

        <div className="mx-auto mt-9 max-w-6xl">
          {showForm && view !== "profile" && view !== "project" && (
            <form
              onSubmit={(e) => void submit(e)}
              className="toon-card paper-note mb-10 grid gap-5 rounded-lg bg-sky p-6 pt-10 sm:grid-cols-2"
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
                <span className="toon-label">What does it do? (type @ to mention developers)</span>
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
                  Any photo from your gallery (iPhone HEIC not yet supported), compressed on-device.
                  First image becomes the card cover.
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
                        Provide your GitHub project repo link first — paste it in the repo
                        link field above, then come back here to choose Markdown files.
                      </p>
                    ) : (
                      <>
                    <p className="text-sm font-bold text-body">
                      Choose Markdown files from the public GitHub repository in your project link.
                    </p>
                    <Button
                      variant="secondary"
                      size="small"
                      type="button"
                      onClick={() => void loadRepositoryFiles()}
                      disabled={repositoryFilesLoading || repositoryFilesImporting}
                      className="mt-3"
                    >
                      {repositoryFilesLoading ? "Loading repository files…" : "Load Markdown files"}
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
                            {selectedRepositoryFiles.length} of {repositoryFiles.length} selected
                          </p>
                          <label className="flex items-center gap-2 text-sm font-black">
                            <input
                              type="checkbox"
                              checked={selectedRepositoryFiles.length === repositoryFiles.length}
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
                          disabled={!selectedRepositoryFiles.length || repositoryFilesImporting}
                          className="mt-3"
                        >
                          {repositoryFilesImporting
                            ? "Importing selected files…"
                            : `Use ${selectedRepositoryFiles.length} selected file${selectedRepositoryFiles.length === 1 ? "" : "s"}`}
                        </Button>
                        <p className="mt-2 text-xs font-bold text-muted">
                          Selected files are combined into project documentation (50,000-character
                          limit).
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
                          This document is {docs.length.toLocaleString()} characters. It exceeds the
                          50,000-character project limit, but you can still download it.
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
                      <Markdown text={docs} />
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
                onBack={() => {
                  window.history.pushState({}, "", "/builders");
                  setView("builders");
                  setSelectedProfileId(null);
                }}
                onOpenApp={openAppFromProfile}
                onOpenProfile={openProfile}
              />
            </section>
          )}

          {view === "discover" && (
            <section id="apps" className="mt-2 scroll-mt-6">
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
                  <Button
                    variant="secondary"
                    onClick={() => void loadApps()}
                    className="mt-5"
                  >
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
              </div>
              <div className="toon-card paper-note grid gap-x-6 gap-y-8 rounded-lg p-6 pt-10 sm:grid-cols-2 sm:p-8 sm:pt-12 lg:grid-cols-3">
                {profiles.map((p) => {
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
                                a.creatorId
                                  ? a.creatorId === user.id
                                  : a.creator === user.name,
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

                  {milestonesLoading ? (
                    <p className="mt-6 font-bold text-muted">Loading updates…</p>
                  ) : milestonesError ? (
                    <div className="toon-card paper-note mt-6 rounded-lg p-10 text-center">
                      <h3 className="text-xl font-black">Could not load updates</h3>
                      <p className="font-bold text-muted">{milestonesError}</p>
                    </div>
                  ) : milestones.length ? (
                    <ul className="mt-6 space-y-4">
                      {milestones.map((m) => {
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
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="toon-card paper-note mt-6 rounded-lg p-10 text-center">
                      <h3 className="text-xl font-black">No updates yet</h3>
                      <p className="font-bold text-muted">
                        Be the first to share what you shipped.
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
                <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Leaderboard view">
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
                        <Avatar
                          name={p.name}
                          color={p.color}
                          imageUrl={p.imageUrl}
                          size="md"
                        />
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
                              <TrophyMark
                                place={projectTrophies.get(app.id) as 1 | 2 | 3}
                              />
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

          <footer className="mb-8 mt-12 border-t-2 border-dashed border-muted py-7 text-center text-sm font-bold text-muted">
            CodeCanvas is built together by the SPECS community.
          </footer>
        </div>
      </div>
    </div>
  );
}
