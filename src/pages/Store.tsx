import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpenText,
  ChatCircleDots,
  DownloadSimple,
  Eye,
  GameController,
  GraduationCap,
  Images,
  LinkSimple,
  MagnifyingGlass,
  Palette,
  PencilSimple,
  Plus,
  RocketLaunch,
  SignOut,
  Sparkle,
  SquaresFour,
  TrendUp,
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
import { getAppRepo, getProfileRepo } from "../data/factory";
import { indexProfiles } from "../data/profileLinks";
import { fileToThumbnailDataUrl } from "../utils/images";
import { readMarkdownFile } from "../utils/readMarkdownFile";
import {
  isGitHubRepositoryUrl,
  listGitHubMarkdownFiles,
  readGitHubMarkdownFiles,
} from "../utils/readGitHubReadme";
import type { Activity, AppItem, Category, CategoryFilter, Profile } from "../data/types";

const categories: { label: CategoryFilter; Icon: typeof SquaresFour }[] = [
  { label: "All", Icon: SquaresFour },
  { label: "Education", Icon: GraduationCap },
  { label: "Productivity", Icon: Wrench },
  { label: "Games", Icon: GameController },
  { label: "Creative", Icon: Palette },
];

type StoreView = "discover" | "builders" | "community" | "profile" | "project";

const routeForView: Record<Exclude<StoreView, "profile" | "project">, string> = {
  discover: "/store",
  builders: "/builders",
  community: "/community",
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

const activityIcon = {
  launch: RocketLaunch,
  feedback: ChatCircleDots,
  milestone: TrendUp,
  join: UsersThree,
} as const;

export default function Store() {
  const { user, signout } = useAuth();
  const [apps, setApps] = useState<AppItem[]>([]);
  const [appsLoading, setAppsLoading] = useState(true);
  const [appsError, setAppsError] = useState<string | null>(null);
  const [fullApps, setFullApps] = useState<AppItem[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("All");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [url, setUrl] = useState("");
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
        const [list, act] = await Promise.all([
          getProfileRepo().listProfiles(),
          getAppRepo().listActivity(),
        ]);
        if (cancelled) return;
        setProfiles(list);
        setActivity(act);
        if (user) {
          setMyProfile(list.find((p) => p.id === user.id) ?? null);
        }
      } catch {
        if (!cancelled) setActivity([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

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
    setUrl("");
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

  const loadRepositoryFiles = async () => {
    if (!isGitHubRepositoryUrl(url)) {
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
      const paths = await listGitHubMarkdownFiles(url, controller.signal);
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
      const files = await readGitHubMarkdownFiles(url, selectedRepositoryFiles, controller.signal);
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
          className="fixed inset-x-0 bottom-0 z-50 grid h-18 grid-cols-3 gap-2 border-t-2 border-ink bg-purple p-2 lg:static lg:mt-12 lg:block lg:h-auto lg:space-y-2 lg:border-0 lg:bg-transparent lg:p-0 lg:pr-1"
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
            Developers
          </a>
          <a
            href="/community"
            onClick={(event) => goTab(event, "community")}
            className={navClass("community")}
          >
            <ChatCircleDots size={22} weight="duotone" />
            Community
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
                <span className="block truncate">{myProfile.name}</span>
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
              <button
                onClick={() => setShowForm((open) => !open)}
                className="toon-button rounded-2xl bg-yellow"
              >
                {showForm ? <X size={20} weight="bold" /> : <Plus size={20} weight="bold" />}
                {showForm ? "Close" : "Submit a project"}
              </button>
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
                <span className="toon-label">What does it do?</span>
                <input
                  className="toon-input"
                  value={desc}
                  onChange={(event) => setDesc(event.target.value)}
                  required
                  placeholder="One clear sentence"
                />
              </label>
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
                      repositoryRequest.current?.abort();
                      setRepositoryFiles([]);
                      setSelectedRepositoryFiles([]);
                      setRepositoryFilesLoading(false);
                      setRepositoryFilesImporting(false);
                      setRepositoryFilesError(null);
                      if (!isGitHubRepositoryUrl(event.target.value)) setDocsTab("write");
                    }}
                    required
                    placeholder="https://project.example"
                    aria-describedby="app-link-help"
                  />
                </span>
                <span id="app-link-help" className="mt-2 block text-xs text-body">
                  Add the live demo, repository, or project page you want the community to visit.
                </span>
              </label>
              <div className="sm:col-span-2">
                <span className="toon-label">Thumbnails (up to 3, first is the cover)</span>
                <label className="toon-button cursor-pointer rounded-2xl bg-surface text-sm">
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
                </label>
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
                  {(isGitHubRepositoryUrl(url)
                    ? (["write", "upload", "repository"] as const)
                    : (["write", "upload"] as const)
                  ).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => {
                        setDocsPreviewReturnTab(tab);
                        setDocsTab(tab);
                      }}
                      aria-pressed={docsTab === tab}
                      className={`rounded-md border-2 border-ink px-3 py-1.5 text-sm font-black capitalize ${docsTab === tab ? "bg-purple text-surface" : "bg-surface"}`}
                    >
                      {tab === "upload"
                        ? "Upload .md"
                        : tab === "repository"
                          ? "GitHub repository"
                          : tab}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      if (docsTab === "preview") setDocsTab(docsPreviewReturnTab);
                      else {
                        setDocsPreviewReturnTab(docsTab);
                        setDocsTab("preview");
                      }
                    }}
                    aria-pressed={docsTab === "preview"}
                    className="ml-auto inline-flex items-center gap-1 rounded-md border-2 border-ink bg-surface px-3 py-1.5 text-sm font-black hover:bg-cream focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow"
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
                  </button>
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
                    <label className="toon-button cursor-pointer rounded-2xl bg-surface text-sm">
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
                    </label>
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
                {docsTab === "repository" && isGitHubRepositoryUrl(url) && (
                  <div className="rounded-xl border-2 border-ink bg-surface p-4">
                    <p className="text-sm font-bold text-body">
                      Choose Markdown files from the public GitHub repository in your project link.
                    </p>
                    <button
                      type="button"
                      onClick={() => void loadRepositoryFiles()}
                      disabled={repositoryFilesLoading || repositoryFilesImporting}
                      className="toon-button mt-3 rounded-2xl bg-yellow text-sm"
                    >
                      {repositoryFilesLoading ? "Loading repository files…" : "Load Markdown files"}
                    </button>
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
                        <button
                          type="button"
                          onClick={() => void importRepositoryFiles()}
                          disabled={!selectedRepositoryFiles.length || repositoryFilesImporting}
                          className="toon-button mt-3 rounded-2xl bg-purple text-sm text-surface disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {repositoryFilesImporting
                            ? "Importing selected files…"
                            : `Use ${selectedRepositoryFiles.length} selected file${selectedRepositoryFiles.length === 1 ? "" : "s"}`}
                        </button>
                        <p className="mt-2 text-xs font-bold text-muted">
                          Selected files are combined into project documentation (50,000-character
                          limit).
                        </p>
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
                        <button
                          type="button"
                          onClick={downloadDocumentation}
                          className="toon-button shrink-0 rounded-2xl bg-surface text-sm"
                        >
                          <DownloadSimple size={18} weight="bold" />
                          Download Markdown
                        </button>
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
              <button
                type="submit"
                disabled={
                  submitting || imageBusy || repositoryFilesLoading || repositoryFilesImporting
                }
                className="toon-button rounded-2xl bg-purple text-surface sm:col-span-2 sm:justify-self-start"
              >
                {submitting
                  ? "Publishing…"
                  : imageBusy
                    ? "Processing images…"
                    : repositoryFilesLoading || repositoryFilesImporting
                      ? "Loading documentation…"
                      : "Publish project"}{" "}
                <ArrowRight size={20} weight="bold" />
              </button>
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
                onBack={() => {
                  window.history.pushState({}, "", "/builders");
                  setView("builders");
                  setSelectedProfileId(null);
                }}
                onOpenApp={openAppFromProfile}
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
                  <button
                    key={label}
                    onClick={() => setCategory(label)}
                    aria-pressed={category === label}
                    className={`flex min-w-max items-center gap-2 rounded-md border-2 border-ink px-3 py-2 text-sm font-black ${category === label ? "bg-purple text-surface" : "bg-surface"}`}
                  >
                    <Icon size={19} weight="duotone" />
                    {label}
                  </button>
                ))}
              </div>
              {appsLoading ? (
                <p className="font-bold text-muted">Loading projects…</p>
              ) : appsError ? (
                <div className="toon-card paper-note rounded-lg p-10 text-center">
                  <h3 className="mt-3 text-xl font-black">Could not load projects</h3>
                  <p className="font-bold text-muted">{appsError}</p>
                  <button
                    onClick={() => void loadApps()}
                    className="toon-button mt-5 rounded-2xl bg-yellow"
                  >
                    Retry
                  </button>
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
                {profiles.map((p) => (
                  <article key={p.id} className="min-w-0">
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
                      </h3>
                    </div>
                    <p className="mt-2 text-sm text-muted">{p.role}</p>
                    <p className="mt-3 text-xs font-black uppercase">
                      {countFor(p)} project{countFor(p) === 1 ? "" : "s"} shared
                    </p>
                  </article>
                ))}
              </div>
            </section>
          )}

          {view === "community" && (
            <section id="activity" className="mt-2 scroll-mt-6">
              <div className="mb-6">
                <p className="text-xs font-black uppercase text-purple">Recent updates</p>
                <h2 className="mt-1 text-2xl font-black">Community activity</h2>
              </div>
              <div className="grid gap-7 lg:grid-cols-[1fr_.7fr]">
                <div className="toon-card rounded-lg bg-surface">
                  {activity.map(({ id, text, time, color, kind }) => {
                    const Icon = activityIcon[kind];
                    return (
                      <div
                        key={id}
                        className="flex items-center gap-4 border-b-2 border-dashed border-divider p-5 last:border-0"
                      >
                        <span
                          style={{ backgroundColor: `var(--color-${color})` }}
                          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-ink"
                        >
                          <Icon size={20} weight="duotone" />
                        </span>
                        <div>
                          <p className="font-black">{text}</p>
                          <p className="text-xs font-bold text-muted">{time}</p>
                        </div>
                      </div>
                    );
                  })}
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

          <footer className="mb-8 mt-12 border-t-2 border-dashed border-muted py-7 text-center text-sm font-bold text-muted">
            CodeCanvas is built together by the SPECS community.
          </footer>
        </div>
      </div>
    </div>
  );
}
