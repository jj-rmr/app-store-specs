import React, { useMemo, useState } from "react";
import {
  ArrowRight,
  ChatCircleDots,
  GameController,
  GraduationCap,
  Heart,
  LinkSimple,
  MagnifyingGlass,
  Palette,
  Plus,
  RocketLaunch,
  SignOut,
  Sparkle,
  SquaresFour,
  TrendUp,
  UsersThree,
  Wrench,
  X,
} from "@phosphor-icons/react";
import { useAuth } from "../auth/AuthProvider";
import Brand from "../components/Brand";

type Category = "All" | "Education" | "Productivity" | "Games" | "Creative";

type AppItem = {
  id: string;
  title: string;
  description: string;
  creator: string;
  category: Exclude<Category, "All">;
  votes: number;
  comments: number;
  color: string;
  url?: string;
};

const starterApps: AppItem[] = [
  {
    id: "1",
    title: "Study Buddy",
    description: "A shared focus timer for study groups.",
    creator: "Mia Santos",
    category: "Education",
    votes: 128,
    comments: 24,
    color: "mint",
  },
  {
    id: "2",
    title: "Campus Bites",
    description: "Find today's best student meals around campus.",
    creator: "Leo Cruz",
    category: "Productivity",
    votes: 94,
    comments: 18,
    color: "pink",
  },
  {
    id: "3",
    title: "Lecture Quizzer",
    description: "Turn lecture notes into short review quizzes.",
    creator: "Sam Rivera",
    category: "Education",
    votes: 81,
    comments: 12,
    color: "sky",
  },
  {
    id: "4",
    title: "Sketch Relay",
    description: "A collaborative drawing challenge for small groups.",
    creator: "Ari Mendoza",
    category: "Games",
    votes: 76,
    comments: 31,
    color: "yellow",
  },
  {
    id: "5",
    title: "Moodboard Mix",
    description: "Collect colors, type, and references with friends.",
    creator: "Nica Flores",
    category: "Creative",
    votes: 63,
    comments: 9,
    color: "lavender",
  },
  {
    id: "6",
    title: "Team Tasks",
    description: "Shared checklists for student project teams.",
    creator: "Jules Tan",
    category: "Productivity",
    votes: 52,
    comments: 15,
    color: "mint",
  },
];

const categories: { label: Category; Icon: typeof SquaresFour }[] = [
  { label: "All", Icon: SquaresFour },
  { label: "Education", Icon: GraduationCap },
  { label: "Productivity", Icon: Wrench },
  { label: "Games", Icon: GameController },
  { label: "Creative", Icon: Palette },
];

type StoreView = "discover" | "builders" | "community";

const routeForView: Record<StoreView, string> = {
  discover: "/store",
  builders: "/builders",
  community: "/community",
};

const copyForView: Record<StoreView, { stamp: string; title: string; description: string }> = {
  discover: {
    stamp: "Student project catalog",
    title: "Explore student-built software.",
    description: "Search projects by name, category, or developer.",
  },
  builders: {
    stamp: "SPECS contributors",
    title: "Meet the developers.",
    description: "Explore student profiles and the projects they have shared with the community.",
  },
  community: {
    stamp: "Community activity",
    title: "What the community is working on.",
    description: "Recent project updates, feedback, and milestones from across SPECS.",
  },
};

export default function Store() {
  const { user, signout } = useAuth();
  const [apps, setApps] = useState<AppItem[]>(starterApps);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("All");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [url, setUrl] = useState("");
  const [voted, setVoted] = useState<Set<string>>(new Set());
  const initialPath = window.location.pathname.replace(/\/$/, "") || "/store";
  const [view, setView] = useState<StoreView>(
    initialPath === "/builders"
      ? "builders"
      : initialPath === "/community"
        ? "community"
        : "discover",
  );

  const visibleApps = useMemo(
    () =>
      apps.filter(
        (app) =>
          (category === "All" || app.category === category) &&
          `${app.title} ${app.description} ${app.creator}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [apps, category, query],
  );
  const logout = () => {
    window.history.replaceState({}, "", "/");
    signout();
  };
  const navigate = (event: React.MouseEvent<HTMLAnchorElement>, nextView: StoreView) => {
    event.preventDefault();
    window.history.pushState({}, "", routeForView[nextView]);
    setView(nextView);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const navClass = (item: StoreView) =>
    `flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 py-0 text-center text-xs font-black leading-tight lg:w-full lg:flex-row lg:justify-start lg:gap-3 lg:px-4 lg:py-3 lg:text-left lg:text-base ${view === item ? "border-2 border-ink bg-yellow text-ink shadow-[2px_2px_0_var(--color-ink)]" : "hover:bg-surface/15"}`;
  const vote = (id: string) => {
    setVoted((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setApps((items) =>
      items.map((app) =>
        app.id === id ? { ...app, votes: app.votes + (voted.has(id) ? -1 : 1) } : app,
      ),
    );
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !desc.trim()) return;
    setApps((items) => [
      {
        id: Date.now().toString(),
        title: title.trim(),
        description: desc.trim(),
        creator: user?.name ?? "New builder",
        category: "Productivity",
        votes: 0,
        comments: 0,
        color: "yellow",
        url: url.trim(),
      },
      ...items,
    ]);
    setTitle("");
    setDesc("");
    setUrl("");
    setShowForm(false);
    setCategory("All");
  };

  return (
    <div className="min-h-screen overflow-x-clip">
      <aside className="fixed inset-x-0 top-0 z-40 h-[85px] border-b-[3px] border-ink bg-purple p-5 text-surface lg:inset-y-0 lg:left-0 lg:right-auto lg:h-screen lg:w-[280px] lg:border-b-0 lg:border-r-[3px] lg:p-7">
        <div className="flex items-center justify-between">
          <Brand light />
          <button
            onClick={logout}
            aria-label="Sign out"
            className="rounded-lg border-2 border-surface p-2 lg:hidden"
          >
            <SignOut size={20} weight="bold" />
          </button>
        </div>
        <nav
          className="fixed inset-x-0 bottom-0 z-50 grid h-[72px] grid-cols-3 gap-2 border-t-2 border-ink bg-purple p-2 lg:static lg:mt-12 lg:block lg:h-auto lg:space-y-2 lg:border-0 lg:bg-transparent lg:p-0 lg:pr-1"
          aria-label="Main navigation"
        >
          <a
            href="/store"
            onClick={(event) => navigate(event, "discover")}
            className={navClass("discover")}
          >
            <MagnifyingGlass size={21} weight="duotone" />
            Discover
          </a>
          <a
            href="/builders"
            onClick={(event) => navigate(event, "builders")}
            className={navClass("builders")}
          >
            <UsersThree size={22} weight="duotone" />
            Developers
          </a>
          <a
            href="/community"
            onClick={(event) => navigate(event, "community")}
            className={navClass("community")}
          >
            <ChatCircleDots size={22} weight="duotone" />
            Community
          </a>
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
            onClick={logout}
            className="mt-7 flex items-center gap-2 text-sm font-black underline decoration-2 underline-offset-4"
          >
            <SignOut size={19} weight="bold" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="min-w-0 px-5 pb-[92px] pt-[105px] sm:px-8 sm:pb-[100px] sm:pt-[117px] lg:ml-[280px] lg:p-10">
        <header id="discover" className="mx-auto max-w-6xl scroll-mt-5">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="ink-stamp bg-surface">{copyForView[view].stamp}</p>
              <h1 className="mt-4 text-3xl font-black sm:text-4xl">{copyForView[view].title}</h1>
              <p className="mt-3 max-w-2xl text-muted">{copyForView[view].description}</p>
            </div>
            <button
              onClick={() => setShowForm((open) => !open)}
              className="toon-button rounded-2xl bg-yellow"
            >
              {showForm ? <X size={20} weight="bold" /> : <Plus size={20} weight="bold" />}
              {showForm ? "Close" : "Submit a project"}
            </button>
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
          {showForm && (
            <form
              onSubmit={submit}
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
              <label className="sm:col-span-2">
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
                    onChange={(event) => setUrl(event.target.value)}
                    required
                    placeholder="https://project.example"
                    aria-describedby="app-link-help"
                  />
                </span>
                <span id="app-link-help" className="mt-2 block text-xs text-body">
                  Add the live demo, repository, or project page you want the community to visit.
                </span>
              </label>
              <button className="toon-button rounded-2xl bg-purple text-surface sm:col-span-2 sm:justify-self-start">
                Publish project <ArrowRight size={20} weight="bold" />
              </button>
            </form>
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
              {visibleApps.length ? (
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {visibleApps.map((app) => (
                    <AppCard key={app.id} app={app} voted={voted.has(app.id)} onVote={vote} />
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
              <div className="toon-card paper-note grid rounded-lg p-6 pt-10 sm:grid-cols-3">
                {[
                  { name: "Mia Santos", role: "Frontend development", apps: 4, color: "pink" },
                  { name: "Leo Cruz", role: "Campus services", apps: 3, color: "yellow" },
                  { name: "Ari Mendoza", role: "Game development", apps: 5, color: "mint" },
                ].map((builder) => (
                  <article
                    key={builder.name}
                    className="border-b-2 border-dashed border-divider-strong py-5 last:border-0 sm:border-b-0 sm:border-r-2 sm:px-6 sm:first:pl-0 sm:last:border-0"
                  >
                    <span
                      style={{ backgroundColor: `var(--color-${builder.color})` }}
                      className="grid h-14 w-14 place-items-center rounded-full border-[3px] border-ink text-lg font-black"
                    >
                      {builder.name
                        .split(" ")
                        .map((part) => part[0])
                        .join("")}
                    </span>
                    <h3 className="mt-4 text-lg font-black">{builder.name}</h3>
                    <p className="text-sm text-muted">{builder.role}</p>
                    <p className="mt-3 text-xs font-black uppercase">
                      {builder.apps} projects shared
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
                  {[
                    {
                      text: "Nica shared Moodboard Mix",
                      time: "12 minutes ago",
                      Icon: RocketLaunch,
                      color: "yellow",
                    },
                    {
                      text: "Sam left feedback on Sketch Relay",
                      time: "35 minutes ago",
                      Icon: ChatCircleDots,
                      color: "sky",
                    },
                    {
                      text: "Study Buddy reached 100 upvotes",
                      time: "1 hour ago",
                      Icon: TrendUp,
                      color: "mint",
                    },
                    {
                      text: "Jules joined the community",
                      time: "2 hours ago",
                      Icon: UsersThree,
                      color: "pink",
                    },
                  ].map(({ text, time, Icon, color }) => (
                    <div
                      key={text}
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
                  ))}
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

function AppCard({
  app,
  voted,
  onVote,
}: {
  app: AppItem;
  voted: boolean;
  onVote: (id: string) => void;
}) {
  return (
    <article className="toon-card paper-note rounded-lg p-5 pt-9">
      <div
        style={{ backgroundColor: `var(--color-${app.color})` }}
        className="project-cover flex h-32 items-center justify-center rounded-sm border-[3px] border-ink"
      >
        <span className="rotate-[-4deg] text-4xl font-black">{app.title.charAt(0)}</span>
      </div>
      <div>
        <div className="mt-5 flex items-start justify-between gap-3 sm:mt-0">
          <div>
            <span className="text-[10px] font-black uppercase text-purple">{app.category}</span>
            <h3 className="text-xl font-black">{app.title}</h3>
          </div>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted">{app.description}</p>
        <p className="mt-3 text-xs font-black">by {app.creator}</p>
        <div className="mt-5 flex items-center gap-4 border-t-2 border-dashed border-divider pt-4">
          <button
            onClick={() => onVote(app.id)}
            aria-pressed={voted}
            className={`flex items-center gap-1 text-sm font-black ${voted ? "text-vote" : ""}`}
          >
            <Heart size={20} weight={voted ? "fill" : "duotone"} />
            {app.votes}
          </button>
          <span className="flex items-center gap-1 text-sm font-black">
            <ChatCircleDots size={20} weight="duotone" />
            {app.comments}
          </span>
          {app.url && (
            <a
              href={app.url}
              target="_blank"
              rel="noreferrer"
              className="ml-auto flex items-center gap-1 text-sm font-black underline decoration-2 underline-offset-4"
            >
              Open app <ArrowRight size={16} weight="bold" />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
