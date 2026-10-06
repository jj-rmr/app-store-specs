import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, ChatCircleDots, Heart, X } from "@phosphor-icons/react";
import Avatar from "./Avatar";
import Comments from "./Comments";
import MentionText from "./MentionText";
import TrophyMark from "./TrophyMark";
import { profileForApp } from "../data/profileLinks";
import type { AppItem, Profile, User } from "../data/types";

type AppCardProps = {
  app: AppItem;
  voted: boolean;
  onVote: (id: string) => void;
  user: User | null;
  expanded: boolean;
  onToggle: (id: string) => void;
  onCommentAdded: (appId: string, count: number) => void;
  profiles: Map<string, Profile>;
  trophies: Map<string, 1 | 2 | 3>;
  projectTrophies: Map<string, 1 | 2 | 3>;
  onOpenProfile: (profileId: string) => void;
  onOpenApp: (appId: string) => void;
  onEditApp: (appId: string) => void;
};

export default function AppCard({
  app,
  voted,
  onVote,
  user,
  expanded,
  onToggle,
  onCommentAdded,
  profiles,
  trophies,
  projectTrophies,
  onOpenProfile,
  onOpenApp,
  onEditApp,
}: AppCardProps) {
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onToggle(app.id);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [expanded, app.id, onToggle]);

  const panelId = `comments-${app.id}`;
  const creatorProfile = profileForApp(app, profiles);
  const creatorName = creatorProfile ? creatorProfile.name : app.creator;
  const isOwner =
    user && (app.creatorId ? app.creatorId === user.id : app.creator === user.name);

  return (
    <article
      className="toon-card paper-note rounded-lg p-5 pt-9"
      style={(() => {
        const place = projectTrophies.get(app.id);
        if (place === 1) return { backgroundColor: "#F7DE6B" };
        if (place === 2) return { backgroundColor: "#DDE3EA" };
        if (place === 3) return { backgroundColor: "#EAC39E" };
        return undefined;
      })()}
    >
      <button
        onClick={() => onOpenApp(app.id)}
        aria-label={`Open ${app.title} details`}
        className="block w-full"
      >
        {app.screenshots?.[0] ? (
          <span className="relative block h-32 w-full overflow-hidden rounded-sm border-[3px] border-ink bg-ink">
            <img
              src={app.screenshots[0]}
              alt=""
              aria-hidden="true"
              loading="lazy"
              className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-xl"
            />
            <img
              src={app.screenshots[0]}
              alt={`${app.title} thumbnail`}
              loading="lazy"
              className="relative h-full w-full object-contain"
            />
          </span>
        ) : (
          <div
            style={{ backgroundColor: `var(--color-${app.color})` }}
            className="project-cover flex h-32 items-center justify-center rounded-sm border-[3px] border-ink"
          >
            <span className="rotate-[-4deg] text-4xl font-black">{app.title.charAt(0)}</span>
          </div>
        )}
      </button>
      <div>
        <div className="mt-5 flex items-start justify-between gap-3 sm:mt-0">
          <div>
            <span className="text-[10px] font-black uppercase text-purple">{app.category}</span>
            <h3 className="text-xl font-black">
              <button onClick={() => onOpenApp(app.id)} className="text-left hover:underline">
                {app.title}
              </button>
              {projectTrophies.get(app.id) !== undefined && (
                <TrophyMark place={projectTrophies.get(app.id) as 1 | 2 | 3} size={22} />
              )}
            </h3>
          </div>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted">
          <MentionText
            text={app.description}
            profiles={[...profiles.values()]}
            onOpenProfile={onOpenProfile}
          />
        </p>
        {(() => {
          const collabs = (app.collaborators ?? [])
            .map((id) => profiles.get(id))
            .filter((p): p is Profile => Boolean(p));
          if (!collabs.length) return null;
          return (
            <p className="mt-2 text-xs font-black">
              <span className="uppercase text-muted">Collaborators: </span>
              {collabs.map((p, i) => (
                <span key={p.id}>
                  {i > 0 && <span className="text-muted">, </span>}
                  <button
                    onClick={() => onOpenProfile(p.id)}
                    className="underline decoration-2 underline-offset-4"
                  >
                    {p.name}
                  </button>
                </span>
              ))}
            </p>
          );
        })()}
        <p className="mt-3 text-xs font-black">
          by{" "}
          {creatorProfile ? (
            <button
              onClick={() => onOpenProfile(creatorProfile.id)}
              className="underline decoration-2 underline-offset-4"
            >
              {creatorName}
            </button>
          ) : (
            creatorName
          )}
          {creatorProfile && trophies.get(creatorProfile.id) !== undefined && (
            <TrophyMark place={trophies.get(creatorProfile.id) as 1 | 2 | 3} size={16} />
          )}
        </p>
        <div className="mt-5 flex items-center gap-4 border-t-2 border-dashed border-divider pt-4">
          <button
            onClick={() => onVote(app.id)}
            aria-pressed={voted}
            className={`flex items-center gap-1 text-sm font-black ${voted ? "text-vote" : ""}`}
          >
            <Heart size={20} weight={voted ? "fill" : "duotone"} />
            {app.votes}
          </button>
          <button
            onClick={() => onToggle(app.id)}
            aria-expanded={expanded}
            aria-haspopup="dialog"
            aria-controls={panelId}
            className="flex items-center gap-1 text-sm font-black"
          >
            <ChatCircleDots size={20} weight={expanded ? "fill" : "duotone"} />
            {app.comments}
            <span className="sr-only">Show comments</span>
          </button>
          {isOwner && (
            <button
              onClick={() => onEditApp(app.id)}
              className="text-sm font-black underline decoration-2 underline-offset-4"
            >
              Edit
            </button>
          )}
          {app.url && (
            <a
              href={app.url}
              target="_blank"
              rel="noreferrer"
              className="toon-button ml-auto rounded-xl bg-purple px-4 py-2 text-sm text-surface"
            >
              Open app <ArrowRight size={16} weight="bold" />
            </a>
          )}
        </div>

        {expanded &&
          createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Comments for ${app.title}`}
              onClick={() => onToggle(app.id)}
              className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-ink/80 p-4"
            >
              <div
                id={panelId}
                onClick={(e) => e.stopPropagation()}
                className="toon-card my-auto flex max-h-[85vh] min-h-0 w-full max-w-lg flex-col overflow-hidden rounded-lg bg-surface"
              >
                <div className="flex shrink-0 items-center justify-between gap-3 border-b-[3px] border-ink p-4">
                  <h4 className="truncate text-lg font-black">
                    Feedback ({app.comments}) · {app.title}
                  </h4>
                  <button
                    type="button"
                    onClick={() => onToggle(app.id)}
                    aria-label="Close comments"
                    autoFocus
                    className="shrink-0 rounded-full border-2 border-ink bg-surface p-1.5"
                  >
                    <X size={16} weight="bold" />
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
                  <Comments
                    appId={app.id}
                    appTitle={app.title}
                    currentUser={user}
                    profiles={profiles}
                    trophies={trophies}
                    onOpenProfile={onOpenProfile}
                    onCommentAdded={onCommentAdded}
                    stickyForm
                  />
                </div>
              </div>
            </div>,
            document.body,
          )}
      </div>
    </article>
  );
}
