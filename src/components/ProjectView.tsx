import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BookOpenText,
  ChatCircleDots,
  Eye,
  DownloadSimple,
  Heart,
  Images,
  LinkSimple,
  PencilSimple,
  Trash,
  X,
} from "@phosphor-icons/react";
import Avatar from "./Avatar";
import Comments from "./Comments";
import Markdown from "./Markdown";
import MarkdownTextarea from "./MarkdownTextarea";
import { getAppRepo, getProfileRepo } from "../data/factory";
import { profileIdForApp } from "../data/profileLinks";
import { fileToThumbnailDataUrl } from "../utils/images";
import { readMarkdownFile } from "../utils/readMarkdownFile";
import { isGitHubRepositoryUrl, readGitHubReadme } from "../utils/readGitHubReadme";
import type { AppItem, Category, Profile, User } from "../data/types";

type ProjectViewProps = {
  appId: string;
  currentUser: User | null;
  profiles: Map<string, Profile>;
  onBack: () => void;
  onOpenProfile: (profileId: string) => void;
  onChanged: () => void;
  onDeleted: () => void;
  startEditing?: boolean;
};

const DOCS_PREVIEW_LIMIT = 1000;

function DocsSection({ text, source }: { text: string; source?: string }) {
  const COLLAPSED_PX = 320;
  const STEP_PX = 600;
  const long = text.length > DOCS_PREVIEW_LIMIT;
  const [height, setHeight] = useState<number | null>(long ? COLLAPSED_PX : null);
  const [hasMore, setHasMore] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const prevCapped = useRef<number>(COLLAPSED_PX);

  useEffect(() => {
    setHeight(text.length > DOCS_PREVIEW_LIMIT ? COLLAPSED_PX : null);
    prevCapped.current = COLLAPSED_PX;
  }, [text]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el || height === null) {
      setHasMore(false);
      return;
    }
    const check = () => setHasMore(el.scrollHeight > height + 24);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, height]);

  const expanded = height === null || height > COLLAPSED_PX;
  const capped = height !== null;

  const seeMore = () => {
    if (height === null) return;
    prevCapped.current = height;
    setHeight(height + STEP_PX);
  };
  const seeLess = () => {
    if (height === null) {
      setHeight(prevCapped.current);
      return;
    }
    setHeight(Math.max(COLLAPSED_PX, height - STEP_PX));
  };
  const showAll = () => {
    if (height !== null) prevCapped.current = height;
    setHeight(null);
  };
  const collapse = () => setHeight(COLLAPSED_PX);
  const download = () => {
    const blobUrl = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = source === "README.md from GitHub" ? "README.md" : "documentation.md";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  };

  return (
    <section className="toon-card paper-note mt-8 rounded-lg p-6 pt-10 sm:p-8 sm:pt-12">
      <div className="mb-3 flex items-center gap-2">
        <BookOpen size={22} weight="duotone" />
        <h3 className="text-2xl font-black">Documentation</h3>
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {source && <p className="text-xs font-black uppercase text-muted">{source}</p>}
        <button
          type="button"
          onClick={download}
          className="toon-button rounded-2xl bg-surface text-sm"
        >
          <DownloadSimple size={19} weight="bold" />
          Download documentation
        </button>
      </div>
      <div
        ref={contentRef}
        style={capped ? { maxHeight: height as number } : undefined}
        className={capped ? "relative overflow-hidden" : undefined}
      >
        <Markdown text={text} />
        {capped && hasMore && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-24"
            style={{ background: "linear-gradient(to top, var(--color-paper), transparent)" }}
          />
        )}
      </div>
      {long && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {hasMore && (
            <button
              onClick={seeMore}
              aria-expanded={expanded}
              className="toon-button rounded-2xl bg-yellow text-sm"
            >
              See more
            </button>
          )}
          {expanded && capped && height > COLLAPSED_PX && (
            <button
              onClick={seeLess}
              aria-expanded={expanded}
              className="toon-button rounded-2xl bg-surface text-sm"
            >
              See less
            </button>
          )}
          {height === null ? (
            <>
              <button
                onClick={seeLess}
                aria-expanded={expanded}
                className="toon-button rounded-2xl bg-surface text-sm"
              >
                See less
              </button>
              <button
                onClick={collapse}
                className="text-sm font-black underline decoration-2 underline-offset-4"
              >
                Collapse
              </button>
            </>
          ) : (
            hasMore && (
              <button
                onClick={showAll}
                className="text-sm font-black underline decoration-2 underline-offset-4"
              >
                Show all
              </button>
            )
          )}
          {capped && !hasMore && expanded && (
            <button
              onClick={collapse}
              className="text-sm font-black underline decoration-2 underline-offset-4"
            >
              Collapse
            </button>
          )}
        </div>
      )}
    </section>
  );
}

export default function ProjectView({
  appId,
  currentUser,
  profiles,
  onBack,
  onOpenProfile,
  onChanged,
  onDeleted,
  startEditing = false,
}: ProjectViewProps) {
  const [app, setApp] = useState<AppItem | null>(null);
  const [developer, setDeveloper] = useState<Profile | null>(null);
  const [feedbackCount, setFeedbackCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [repositoryReadme, setRepositoryReadme] = useState<string | null>(null);
  const [readmeLoading, setReadmeLoading] = useState(false);
  const [readmeError, setReadmeError] = useState<string | null>(null);
  const [editing, setEditing] = useState(startEditing);
  const [eTitle, setETitle] = useState("");
  const [eDesc, setEDesc] = useState("");
  const [eUrl, setEUrl] = useState("");
  const [eCategory, setECategory] = useState<Category>("Productivity");
  const [eShots, setEShots] = useState<string[]>([]);
  const [eDocs, setEDocs] = useState("");
  const [eDocsTab, setEDocsTab] = useState<"write" | "upload" | "preview">("write");
  const [eDocsPreviewReturnTab, setEDocsPreviewReturnTab] = useState<"write" | "upload">("write");
  const [eDocsFile, setEDocsFile] = useState<string | null>(null);
  const [eBusy, setEBusy] = useState(false);
  const [eImgError, setEImgError] = useState<string | null>(null);
  const [eSaving, setESaving] = useState(false);
  const [eError, setEError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const fetched = await getAppRepo().getApp(appId, currentUser?.id);
        if (cancelled) return;
        setApp(fetched);
        setFeedbackCount(fetched.comments);
        const dev = await (async () => {
          const pid = profileIdForApp(fetched, profiles);
          if (pid) {
            try {
              return await getProfileRepo().getProfile(pid);
            } catch {
              return null;
            }
          }
          return await getProfileRepo().getProfileByName(fetched.creator);
        })();
        if (cancelled) return;
        setDeveloper(dev);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load project.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appId, currentUser?.id, profiles]);

  useEffect(() => {
    const controller = new AbortController();
    setRepositoryReadme(null);
    setReadmeError(null);

    if (!app?.url || app.docs?.trim() || !isGitHubRepositoryUrl(app.url)) {
      setReadmeLoading(false);
      return () => controller.abort();
    }

    setReadmeLoading(true);
    void readGitHubReadme(app.url, controller.signal)
      .then(setRepositoryReadme)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setReadmeError(
            cause instanceof Error ? cause.message : "Could not load the repository README.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setReadmeLoading(false);
      });

    return () => controller.abort();
  }, [app?.docs, app?.url]);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [lightbox]);

  const vote = async () => {
    if (!app || !currentUser) return;
    const previous = app;
    setApp({
      ...app,
      votes: Math.max(0, app.votes + (app.viewerHasVoted ? -1 : 1)),
      viewerHasVoted: !app.viewerHasVoted,
    });
    try {
      const updated = await getAppRepo().toggleVote(app.id, currentUser.id);
      setApp(updated);
    } catch {
      setApp(previous);
    }
  };

  const isOwner =
    currentUser &&
    app &&
    (app.creatorId ? app.creatorId === currentUser.id : app.creator === currentUser.name);

  const beginEdit = () => {
    if (!app) return;
    setETitle(app.title);
    setEDesc(app.description);
    setEUrl(app.url ?? "");
    setECategory(app.category);
    setEShots(app.screenshots ?? []);
    setEDocs(app.docs ?? "");
    setEDocsTab("write");
    setEDocsPreviewReturnTab("write");
    setEDocsFile(null);
    setEError(null);
    setConfirmDelete(false);
    setEditing(true);
  };

  const deleteProject = async () => {
    if (!app || !currentUser || deleting) return;
    setDeleting(true);
    setEError(null);
    try {
      await getAppRepo().deleteApp(app.id, currentUser);
      onDeleted();
    } catch (err) {
      setEError(err instanceof Error ? err.message : "Could not delete project.");
    } finally {
      setDeleting(false);
    }
  };

  const pickShots = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setEBusy(true);
    setEImgError(null);
    try {
      const room = 3 - eShots.length;
      const chosen = Array.from(files).slice(0, Math.max(0, room));
      const compressed = await Promise.all(chosen.map((f) => fileToThumbnailDataUrl(f)));
      setEShots((prev) => [...prev, ...compressed].slice(0, 3));
    } catch (e) {
      setEImgError(e instanceof Error ? e.message : "Could not read those images.");
    } finally {
      setEBusy(false);
    }
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!app || !currentUser || eSaving || eBusy) return;
    setESaving(true);
    setEError(null);
    try {
      const updated = await getAppRepo().updateApp(app.id, currentUser, {
        title: eTitle,
        description: eDesc,
        url: eUrl,
        category: eCategory,
        screenshots: eShots,
        docs: eDocs,
      });
      setApp(updated);
      setEditing(false);
      onChanged();
    } catch (err) {
      setEError(err instanceof Error ? err.message : "Could not save changes.");
    } finally {
      setESaving(false);
    }
  };

  if (loading) return <p className="font-bold text-muted">Loading project…</p>;
  if (error || !app) {
    return (
      <div className="toon-card paper-note rounded-lg p-10 text-center">
        <h3 className="text-xl font-black">Project not found</h3>
        <p className="font-bold text-muted">{error ?? "This project does not exist."}</p>
        <button onClick={onBack} className="toon-button mt-5 rounded-2xl bg-yellow">
          <ArrowLeft size={18} weight="bold" /> Back
        </button>
      </div>
    );
  }

  const cover = app.screenshots?.[0];
  const rest = (app.screenshots ?? []).slice(1);

  return (
    <div>
      <button onClick={onBack} className="toon-button rounded-2xl bg-surface px-4 py-2 text-sm">
        <ArrowLeft size={18} weight="bold" /> Back to projects
      </button>

      <div className="toon-card paper-note mt-5 overflow-hidden rounded-lg">
        {cover ? (
          <button
            type="button"
            onClick={() => setLightbox(cover)}
            aria-label={`View ${app.title} cover full size`}
            className="block w-full cursor-zoom-in"
          >
            <span className="relative block h-64 w-full overflow-hidden border-b-[3px] border-ink bg-ink sm:h-80">
              <img
                src={cover}
                alt=""
                aria-hidden="true"
                loading="lazy"
                className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl"
              />
              <img
                src={cover}
                alt={`${app.title} thumbnail`}
                loading="lazy"
                className="relative h-full w-full object-contain"
              />
            </span>
          </button>
        ) : (
          <div
            style={{ backgroundColor: `var(--color-${app.color})` }}
            className="project-cover flex h-48 items-center justify-center border-b-[3px] border-ink"
          >
            <span className="rotate-[-4deg] text-6xl font-black">{app.title.charAt(0)}</span>
          </div>
        )}
        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <p className="ink-stamp bg-surface">{app.category}</p>
            {isOwner && !editing && (
              <button onClick={beginEdit} className="toon-button rounded-2xl bg-yellow text-sm">
                <PencilSimple size={18} weight="bold" /> Edit project
              </button>
            )}
          </div>
          <h2 className="mt-4 text-3xl font-black sm:text-4xl">{app.title}</h2>
          <p className="mt-3 max-w-3xl text-lg leading-8 text-body">{app.description}</p>

          <div className="mt-5 flex flex-wrap items-center gap-4">
            <button
              onClick={() => void vote()}
              aria-pressed={Boolean(app.viewerHasVoted)}
              disabled={!currentUser}
              className={`flex items-center gap-1 text-sm font-black ${app.viewerHasVoted ? "text-vote" : ""}`}
            >
              <Heart size={20} weight={app.viewerHasVoted ? "fill" : "duotone"} />
              {app.votes} upvotes
            </button>
            <span className="flex items-center gap-1 text-sm font-black">
              <ChatCircleDots size={20} weight="duotone" />
              {app.comments} feedback
            </span>
            {app.url && (
              <a
                href={app.url}
                target="_blank"
                rel="noreferrer"
                className="toon-button ml-auto rounded-2xl bg-purple px-5 py-2.5 text-sm text-surface"
              >
                Open app <ArrowRight size={16} weight="bold" />
              </a>
            )}
          </div>

          {developer && (
            <button
              onClick={() => onOpenProfile(developer.id)}
              className="mt-6 flex w-full items-center gap-4 rounded-2xl border-[3px] border-ink bg-surface p-4 text-left shadow-[3px_3px_0_var(--color-ink)]"
            >
              <Avatar
                name={developer.name}
                color={developer.color}
                imageUrl={developer.imageUrl}
                size="md"
              />
              <span className="min-w-0">
                <span className="block text-xs font-black uppercase text-purple">Built by</span>
                <span className="block truncate text-lg font-black">{developer.name}</span>
                <span className="block truncate text-sm font-bold text-muted">
                  {developer.role}
                </span>
              </span>
              <ArrowRight size={20} weight="bold" className="ml-auto shrink-0" />
            </button>
          )}
        </div>
      </div>

      {editing && (
        <form
          onSubmit={(e) => void saveEdit(e)}
          className="toon-card paper-note mt-8 grid gap-5 rounded-lg bg-sky p-6 pt-10 sm:grid-cols-2"
        >
          <div className="sm:col-span-2">
            <PencilSimple size={32} weight="duotone" />
            <h3 className="mt-2 text-2xl font-black">Edit project</h3>
            <p className="text-body">Only you can see this form — you own this project.</p>
          </div>
          <label>
            <span className="toon-label">Project name</span>
            <input
              className="toon-input"
              value={eTitle}
              onChange={(e) => setETitle(e.target.value)}
              required
              maxLength={80}
              placeholder="Project name"
            />
          </label>
          <label>
            <span className="toon-label">Category</span>
            <select
              className="toon-input"
              value={eCategory}
              onChange={(e) => setECategory(e.target.value as Category)}
            >
              <option value="Education">Education</option>
              <option value="Productivity">Productivity</option>
              <option value="Games">Games</option>
              <option value="Creative">Creative</option>
            </select>
          </label>
          <label className="sm:col-span-2">
            <span className="toon-label">What does it do?</span>
            <input
              className="toon-input"
              value={eDesc}
              onChange={(e) => setEDesc(e.target.value)}
              required
              maxLength={280}
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
                value={eUrl}
                onChange={(e) => setEUrl(e.target.value)}
                placeholder="https://project.example"
              />
            </span>
          </label>
          <div className="sm:col-span-2">
            <span className="toon-label">Thumbnails (up to 3, first is the cover)</span>
            <label className="toon-button cursor-pointer rounded-2xl bg-surface text-sm">
              <Images size={20} weight="duotone" />
              {eBusy ? "Processing…" : "Choose from gallery"}
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                disabled={eBusy || eShots.length >= 3}
                onChange={(e) => {
                  void pickShots(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
            {eImgError && (
              <p role="alert" className="mt-2 text-sm font-bold">
                {eImgError}
              </p>
            )}
            {eShots.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-3">
                {eShots.map((src, i) => (
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
                      onClick={() => setEShots((prev) => prev.filter((_, j) => j !== i))}
                      aria-label={`Remove image ${i + 1}`}
                      className="absolute right-2 top-2 rounded-full border-2 border-ink bg-surface p-1"
                    >
                      <X size={14} weight="bold" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="sm:col-span-2">
            <span className="toon-label">Documentation (optional, markdown supported)</span>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {(["write", "upload"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    setEDocsPreviewReturnTab(tab);
                    setEDocsTab(tab);
                  }}
                  aria-pressed={eDocsTab === tab}
                  className={`rounded-md border-2 border-ink px-3 py-1.5 text-sm font-black capitalize ${eDocsTab === tab ? "bg-purple text-surface" : "bg-surface"}`}
                >
                  {tab === "upload" ? "Upload .md" : tab}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  if (eDocsTab === "preview") setEDocsTab(eDocsPreviewReturnTab);
                  else {
                    setEDocsPreviewReturnTab(eDocsTab);
                    setEDocsTab("preview");
                  }
                }}
                aria-pressed={eDocsTab === "preview"}
                className="ml-auto inline-flex items-center gap-1 rounded-md border-2 border-ink bg-surface px-3 py-1.5 text-sm font-black hover:bg-cream focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow"
              >
                {eDocsTab === "preview" ? (
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
            {eDocsTab === "write" && (
              <MarkdownTextarea
                className="min-h-24"
                value={eDocs}
                onChange={(e) => {
                  setEDocs(e.target.value);
                  setEDocsFile(null);
                }}
                maxLength={50000}
                placeholder={"# My project\n\nWhat it does, how to run it…"}
              />
            )}
            {eDocsTab === "upload" && (
              <div>
                <label className="toon-button cursor-pointer rounded-2xl bg-surface text-sm">
                  <BookOpenText size={20} weight="duotone" />
                  Choose README.md
                  <input
                    type="file"
                    accept=".md,.markdown,.txt,text/markdown,text/plain"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      readMarkdownFile(file)
                        .then(({ name, text }) => {
                          setEDocs(text);
                          setEDocsFile(name);
                          setEDocsPreviewReturnTab("upload");
                          setEDocsTab("preview");
                          setEError(null);
                        })
                        .catch((err) =>
                          setEError(err instanceof Error ? err.message : "Could not read file."),
                        );
                    }}
                  />
                </label>
                {eDocsFile && (
                  <p className="mt-2 text-sm font-bold text-muted">
                    {eDocsFile} · {eDocs.length} chars
                  </p>
                )}
              </div>
            )}
            {eDocsTab === "preview" && (
              <div className="rounded-2xl border-[3px] border-ink bg-surface p-4">
                {eDocs.trim() ? (
                  <Markdown text={eDocs} />
                ) : (
                  <p className="text-sm font-bold text-muted">
                    Nothing to preview yet — write some markdown or upload a README.
                  </p>
                )}
              </div>
            )}
          </div>
          {eError && (
            <p role="alert" className="text-sm font-bold sm:col-span-2">
              {eError}
            </p>
          )}
          <div className="flex flex-wrap gap-3 sm:col-span-2">
            <button
              type="submit"
              disabled={eSaving || eBusy}
              className="toon-button rounded-2xl bg-purple text-surface"
            >
              {eSaving ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setEError(null);
                setConfirmDelete(false);
              }}
              className="toon-button rounded-2xl bg-surface"
            >
              Cancel
            </button>
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="toon-button ml-auto rounded-2xl bg-surface text-sm text-alert"
              >
                <Trash size={18} weight="bold" /> Delete project
              </button>
            ) : (
              <div
                role="alert"
                className="flex w-full flex-wrap items-center gap-3 rounded-2xl border-[3px] border-ink bg-surface p-4"
              >
                <p className="w-full text-sm font-black">
                  Delete “{app.title}” forever? Its screenshots, docs, and feedback go with it. This
                  cannot be undone.
                </p>
                <button
                  type="button"
                  onClick={() => void deleteProject()}
                  disabled={deleting}
                  className="toon-button rounded-2xl bg-alert px-4 py-2 text-sm text-surface"
                >
                  <Trash size={16} weight="bold" /> {deleting ? "Deleting…" : "Yes, delete it"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                  className="toon-button rounded-2xl bg-yellow px-4 py-2 text-sm"
                >
                  Keep it
                </button>
              </div>
            )}
          </div>
        </form>
      )}

      {rest.length > 0 && (
        <section className="mt-8">
          <div className="mb-4 flex items-center gap-2">
            <Images size={22} weight="duotone" />
            <h3 className="text-2xl font-black">Screenshots</h3>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {rest.map((src, i) => (
              <button
                key={src.slice(0, 64) + i}
                type="button"
                onClick={() => setLightbox(src)}
                aria-label={`View ${app.title} screenshot ${i + 1} full size`}
                className="toon-card block w-full cursor-zoom-in overflow-hidden rounded-lg p-0 text-left"
              >
                <span className="relative block aspect-video w-full overflow-hidden bg-ink">
                  <img
                    src={src}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl"
                  />
                  <img
                    src={src}
                    alt={`${app.title} screenshot ${i + 1}`}
                    loading="lazy"
                    className="relative h-full w-full object-contain"
                  />
                </span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs font-bold text-muted">
            Fixed preview box — click any image to view it full size.
          </p>
        </section>
      )}

      {lightbox &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${app.title} screenshot full size`}
            onClick={() => setLightbox(null)}
            className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-ink/80 p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="toon-card relative my-auto max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-lg bg-surface"
            >
              <img
                src={lightbox}
                alt={`${app.title} screenshot full size`}
                className="max-h-[85vh] w-full object-contain"
              />
              <button
                type="button"
                onClick={() => setLightbox(null)}
                aria-label="Close full size image"
                autoFocus
                className="absolute right-3 top-3 rounded-full border-2 border-ink bg-surface p-2"
              >
                <X size={18} weight="bold" />
              </button>
            </div>
          </div>,
          document.body,
        )}

      {app.docs?.trim() ? (
        <DocsSection text={app.docs} />
      ) : readmeLoading ? (
        <section
          aria-live="polite"
          className="toon-card paper-note mt-8 rounded-lg p-6 pt-10 sm:p-8 sm:pt-12"
        >
          <div className="mb-3 flex items-center gap-2">
            <BookOpen size={22} weight="duotone" />
            <h3 className="text-2xl font-black">Loading repository README…</h3>
          </div>
          <p className="font-bold text-muted">Checking GitHub for README.md.</p>
        </section>
      ) : repositoryReadme ? (
        <DocsSection text={repositoryReadme} source="README.md from GitHub" />
      ) : readmeError ? (
        <section
          role="status"
          className="toon-card paper-note mt-8 rounded-lg p-6 pt-10 sm:p-8 sm:pt-12"
        >
          <div className="mb-3 flex items-center gap-2">
            <BookOpen size={22} weight="duotone" />
            <h3 className="text-2xl font-black">Repository README unavailable</h3>
          </div>
          <p className="font-bold text-muted">{readmeError}</p>
        </section>
      ) : app.url && isGitHubRepositoryUrl(app.url) ? (
        <section className="toon-card paper-note mt-8 rounded-lg p-6 pt-10 sm:p-8 sm:pt-12">
          <div className="mb-3 flex items-center gap-2">
            <BookOpen size={22} weight="duotone" />
            <h3 className="text-2xl font-black">No repository README found</h3>
          </div>
          <p className="font-bold text-muted">
            Add custom documentation or a README.md to this public GitHub repository.
          </p>
        </section>
      ) : null}

      <section className="toon-card mt-8 rounded-lg bg-surface p-6 sm:p-8">
        <h3 className="text-2xl font-black">Feedback ({feedbackCount})</h3>
        <div className="mt-5">
          <Comments
            appId={app.id}
            appTitle={app.title}
            currentUser={currentUser}
            profiles={profiles}
            onOpenProfile={onOpenProfile}
            onCommentAdded={(_id, count) => {
              setFeedbackCount(count);
              setApp((prev) => (prev ? { ...prev, comments: count } : prev));
            }}
          />
        </div>
      </section>
    </div>
  );
}
