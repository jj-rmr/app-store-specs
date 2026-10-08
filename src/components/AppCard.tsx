import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  ChatCircleDots,
  Heart,
  PencilSimple,
  User as UserIcon,
  X,
} from "@phosphor-icons/react";
import Comments from "./Comments";
import MentionText from "./MentionText";
import { profileForApp } from "../data/profileLinks";
import type { AppItem, Profile, User } from "../data/types";
import { Button, ButtonChip, ButtonLink } from "./Button";
import TrophyMark from "./TrophyMark";

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
  projectRanks: Map<string, number>;
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
  projectRanks,
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
  const collaborators = (app.collaborators ?? [])
    .map((id) => profiles.get(id))
    .filter((profile): profile is Profile => Boolean(profile));
  const projectRank = projectRanks.get(app.id);
  const trophyPlace =
    projectRank === 1 || projectRank === 2 || projectRank === 3 ? projectRank : undefined;
  const isOwner = user && (app.creatorId ? app.creatorId === user.id : app.creator === user.name);

  return (
    <article className="toon-card paper-note flex h-full flex-col rounded-lg p-4 rotate-1">
      <button
        onClick={() => onOpenApp(app.id)}
        aria-label={`Open ${app.title} details`}
        className="block w-full"
      >
        {app.screenshots?.[0] ? (
          <span className="relative block h-48 w-full overflow-hidden rounded-sm border-[3px] border-ink bg-ink">
            <img
              src={app.screenshots[0]}
              alt={`${app.title} thumbnail`}
              loading="lazy"
              className="relative h-full w-full object-cover"
            />
          </span>
        ) : (
          <div
            style={{ backgroundColor: `var(--color-${app.color})` }}
            className="project-cover flex h-48 items-center justify-center rounded-sm border-[3px] border-ink"
          >
            <span className="rotate-[-4deg] text-4xl font-black">{app.title.charAt(0)}</span>
          </div>
        )}
      </button>
      <div className="flex flex-1 flex-col">
        <div className="mt-5 flex items-start justify-between gap-3 sm:mt-0">
          <div>
            <span className="text-[10px] font-black uppercase text-purple">{app.category}</span>
            <h3 className="text-xl font-black">
              <button onClick={() => onOpenApp(app.id)} className="text-left hover:underline">
                {app.title}
              </button>
              {projectRank !== undefined &&
                (trophyPlace !== undefined ? (
                  <TrophyMark place={trophyPlace} size={20} />
                ) : (
                  <ButtonChip className="ml-2" tone="muted">
                    #{projectRank} App
                  </ButtonChip>
                ))}
            </h3>
          </div>
        </div>
        <div className="mt-2 overflow-hidden text-xs leading-5">
          <p className="max-h-full overflow-hidden">
            <UserIcon
              size={15}
              weight="duotone"
              className="mr-2 inline-block align-[-3px] text-muted"
              aria-hidden="true"
            />
            {creatorProfile ? (
              <Button
                variant="text"
                size="compact"
                onClick={() => onOpenProfile(creatorProfile.id)}
                className="text-left text-muted"
                aria-label={`View ${creatorName}'s profile`}
              >
                {creatorName}
              </Button>
            ) : (
              <span>{creatorName}</span>
            )}
            {collaborators.length > 0 && (
              <>
                <span className="mx-1">-</span>
                {collaborators.map((profile, index) => (
                  <React.Fragment key={profile.id}>
                    {index > 0 && <span>, </span>}
                    <Button
                      variant="text"
                      size="compact"
                      className="text-muted"
                      onClick={() => onOpenProfile(profile.id)}
                    >
                      {profile.name}
                    </Button>
                  </React.Fragment>
                ))}
              </>
            )}
          </p>
        </div>
        <p className="my-4 line-clamp-4 flex-1 text-sm leading-6 text-muted">
          <MentionText
            text={app.description}
            profiles={[...profiles.values()]}
            onOpenProfile={onOpenProfile}
          />
        </p>
        <div className="mt-auto flex min-h-8 items-center gap-4 border-t-2 border-dashed border-divider pt-3">
          <span className="flex gap-2">
            <Button variant="vote" onClick={() => onVote(app.id)} aria-pressed={voted}>
              <Heart size={20} weight={voted ? "fill" : "duotone"} />
              {app.votes}
            </Button>
            <Button
              variant="vote"
              onClick={() => onToggle(app.id)}
              aria-expanded={expanded}
              aria-haspopup="dialog"
              aria-controls={panelId}
            >
              <ChatCircleDots size={20} weight={expanded ? "fill" : "duotone"} />
              {app.comments}
              <span className="sr-only">Show comments</span>
            </Button>
          </span>
          <span className="ml-auto flex items-center gap-2">
            {isOwner && (
              <Button
                variant="outline-flat"
                size="compact"
                onClick={() => onEditApp(app.id)}
                aria-label={`Edit ${app.title}`}
              >
                <PencilSimple size={16} weight="duotone" />
              </Button>
            )}
            {app.url && (
              <ButtonLink
                href={app.url}
                target="_blank"
                rel="noreferrer"
                variant="outline-flat"
                size="compact"
              >
                Open app <ArrowRight size={14} weight="duotone" />
              </ButtonLink>
            )}
          </span>
        </div>

        {expanded &&
          createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Comments for ${app.title}`}
              onClick={() => onToggle(app.id)}
              className="fixed inset-0 z-100 flex items-center justify-center overflow-y-auto bg-ink/80 p-4"
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
