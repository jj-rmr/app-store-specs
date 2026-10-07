import React, { useEffect, useState } from "react";
import { ChatCircleDots, Heart } from "@phosphor-icons/react";
import Avatar from "./Avatar";
import TrophyMark from "./TrophyMark";
import { Button } from "./Button";
import { getAppRepo } from "../data/factory";
import { profileForComment } from "../data/profileLinks";
import type { Comment, Profile, User } from "../data/types";

type CommentsProps = {
  appId: string;
  appTitle: string;
  currentUser: User | null;
  profiles: Map<string, Profile>;
  trophies: Map<string, 1 | 2 | 3>;
  onOpenProfile: (profileId: string) => void;
  onCommentAdded?: (appId: string, count: number) => void;
  stickyForm?: boolean;
};

const REPLY_INITIAL = 1;
const REPLY_STEP = 3;

function authorHeader(
  c: Comment,
  profiles: Map<string, Profile>,
  trophies: Map<string, 1 | 2 | 3>,
  onOpenProfile: (profileId: string) => void,
  avatarSize: "sm" = "sm",
) {
  const p = profileForComment(c, profiles);
  const displayName = p ? p.name : c.authorName;
  const place = trophies.get(c.authorId);
  return (
    <div className="flex items-center gap-2">
      {p ? (
        <button
          onClick={() => onOpenProfile(p.id)}
          aria-label={`View ${p.name}'s profile`}
          className="shrink-0"
        >
          <Avatar name={p.name} color={p.color} imageUrl={p.imageUrl} size={avatarSize} />
        </button>
      ) : (
        <Avatar name={c.authorName} color="sky" size={avatarSize} />
      )}
      <p className="min-w-0 text-xs font-black">
        {p ? (
          <button
            onClick={() => onOpenProfile(p.id)}
            className="underline decoration-2 underline-offset-4"
          >
            {displayName}
          </button>
        ) : (
          displayName
        )}
        {place !== undefined && <TrophyMark place={place} size={16} />}
        {" "}
        <span className="font-bold text-muted">· {new Date(c.createdAt).toLocaleString()}</span>
      </p>
    </div>
  );
}

export default function Comments({
  appId,
  appTitle,
  currentUser,
  profiles,
  trophies,
  onOpenProfile,
  onCommentAdded,
  stickyForm = false,
}: CommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [replying, setReplying] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [likePending, setLikePending] = useState<Set<string>>(new Set());
  const [visibleReplies, setVisibleReplies] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getAppRepo()
      .listComments(appId, currentUser?.id)
      .then((items) => {
        if (!cancelled) setComments(items);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load comments.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [appId, currentUser?.id]);

  const topLevel = comments
    .filter((c) => !c.parentId)
    .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
  const childrenOf = (parentId: string) =>
    comments
      .filter((c) => c.parentId === parentId)
      .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));

  const toggleLike = async (c: Comment) => {
    if (!currentUser || likePending.has(c.id)) return;
    setLikePending((prev) => new Set(prev).add(c.id));
    const wasLiked = Boolean(c.viewerHasLiked);
    setComments((items) =>
      items.map((x) =>
        x.id === c.id
          ? {
              ...x,
              viewerHasLiked: !wasLiked,
              likes: Math.max(0, (x.likes ?? 0) + (wasLiked ? -1 : 1)),
            }
          : x,
      ),
    );
    try {
      const updated = await getAppRepo().toggleCommentLike(appId, c.id, currentUser.id);
      setComments((items) => items.map((x) => (x.id === c.id ? { ...x, ...updated } : x)));
    } catch {
      setComments((items) => items.map((x) => (x.id === c.id ? c : x)));
    } finally {
      setLikePending((prev) => {
        const next = new Set(prev);
        next.delete(c.id);
        return next;
      });
    }
  };

  const postTop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !body.trim() || posting) return;
    setPosting(true);
    setPostError(null);
    try {
      const created = await getAppRepo().addComment(appId, currentUser, body.trim());
      setComments((items) => {
        onCommentAdded?.(appId, items.length + 1);
        return [...items, created];
      });
      setBody("");
    } catch (e) {
      setPostError(e instanceof Error ? e.message : "Could not post comment.");
    } finally {
      setPosting(false);
    }
  };

  const openReply = (parentId: string) => {
    setReplyTo(parentId);
    setReplyBody("");
    setReplyError(null);
  };

  const postReply = async (e: React.FormEvent, parentId: string) => {
    e.preventDefault();
    if (!currentUser || !replyBody.trim() || replying) return;
    setReplying(true);
    setReplyError(null);
    try {
      const created = await getAppRepo().addComment(appId, currentUser, replyBody.trim(), parentId);
      setComments((items) => {
        const next = [...items, created];
        onCommentAdded?.(appId, next.length);
        return next;
      });
      setVisibleReplies((prev) => {
        const total = comments.filter((x) => x.parentId === parentId).length + 1;
        return { ...prev, [parentId]: total };
      });
      setReplyTo(null);
      setReplyBody("");
    } catch (e) {
      setReplyError(e instanceof Error ? e.message : "Could not post reply.");
    } finally {
      setReplying(false);
    }
  };

  const likeButton = (c: Comment, small = false) => (
    <Button
      variant="vote"
      size={small ? "compact" : "default"}
      type="button"
      onClick={() => void toggleLike(c)}
      aria-pressed={Boolean(c.viewerHasLiked)}
      aria-label={c.viewerHasLiked ? "Unlike this comment" : "Like this comment"}
      disabled={!currentUser || likePending.has(c.id)}
      title={currentUser ? undefined : "Sign in to like"}
      className={c.viewerHasLiked ? "" : "text-muted"}
    >
      <Heart size={small ? 15 : 16} weight={c.viewerHasLiked ? "fill" : "duotone"} />
      {c.likes ?? 0}
    </Button>
  );

  const form = (
    <>
      {currentUser ? (
        <form onSubmit={(e) => void postTop(e)} className="flex gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Add feedback for {appTitle}</span>
            <input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={500}
              placeholder="Share useful feedback…"
              className="toon-input py-2 text-sm"
            />
          </label>
          <Button
            variant="secondary"
            size="small"
            type="submit"
            disabled={posting || !body.trim()}
            className="shrink-0"
          >
            {posting ? "…" : "Post"}
          </Button>
        </form>
      ) : (
        <p className="text-sm font-bold text-muted">Sign in to join the discussion.</p>
      )}
      {postError && (
        <p role="alert" className="mt-2 text-sm font-bold">
          {postError}
        </p>
      )}
    </>
  );

  const renderNode = (c: Comment, depth: number): React.ReactNode => {
    const kids = childrenOf(c.id);
    const visible = Math.min(visibleReplies[c.id] ?? REPLY_INITIAL, Math.max(kids.length, 1));
    const shown = kids.slice(0, visible);
    const hidden = kids.length - shown.length;
    const parent = c.parentId ? comments.find((x) => x.id === c.parentId) : undefined;
    const replyTarget = replyTo === c.id ? comments.find((x) => x.id === c.id) : undefined;
    const childListClass =
      depth < 2 ? "mt-3 space-y-2 border-l-2 border-divider pl-3" : "mt-3 space-y-2";
    return (
      <li
        key={c.id}
        className={
          depth === 0
            ? "rounded-xl border-2 border-dashed border-divider p-3"
            : "rounded-lg bg-cream/60 p-2.5"
        }
      >
        {authorHeader(c, profiles, trophies, onOpenProfile)}
        <p className="mt-1.5 text-sm leading-6">
          {depth >= 2 && parent && (
            <span
              title={`Replying to ${parent.authorName}`}
              className="mr-1.5 rounded-md bg-purple/15 px-1.5 py-0.5 text-xs font-black text-purple"
            >
              @{parent.authorName}
            </span>
          )}
          {c.body}
        </p>
        <div className="mt-1.5 flex items-center gap-4">
          {likeButton(c, depth > 0)}
          {currentUser ? (
            <button
              type="button"
              onClick={() => (replyTo === c.id ? setReplyTo(null) : openReply(c.id))}
              className="flex items-center gap-1 text-xs font-black text-muted"
            >
              <ChatCircleDots size={15} weight="duotone" />
              {replyTo === c.id ? "Cancel" : "Reply"}
              {kids.length > 0 && ` (${kids.length})`}
            </button>
          ) : (
            kids.length > 0 && (
              <span className="text-xs font-black text-muted">
                {kids.length} {kids.length === 1 ? "reply" : "replies"}
              </span>
            )
          )}
        </div>

        {shown.length > 0 && (
          <ul className={childListClass}>{shown.map((r) => renderNode(r, depth + 1))}</ul>
        )}

        {kids.length > REPLY_INITIAL && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {hidden > 0 && (
              <Button
                variant="surface"
                size="compact"
                type="button"
                onClick={() =>
                  setVisibleReplies((prev) => ({
                    ...prev,
                    [c.id]: visible + REPLY_STEP,
                  }))
                }
              >
                See more ({hidden} more)
              </Button>
            )}
            {visible > REPLY_INITIAL && (
              <Button
                variant="surface"
                size="compact"
                type="button"
                onClick={() =>
                  setVisibleReplies((prev) => ({
                    ...prev,
                    [c.id]: Math.max(REPLY_INITIAL, visible - REPLY_STEP),
                  }))
                }
              >
                See less
              </Button>
            )}
            {hidden > 0 ? (
              <button
                type="button"
                onClick={() => setVisibleReplies((prev) => ({ ...prev, [c.id]: kids.length }))}
                className="text-xs font-black underline decoration-2 underline-offset-4"
              >
                Show all ({kids.length})
              </button>
            ) : (
              visible > REPLY_INITIAL && (
                <button
                  type="button"
                  onClick={() => setVisibleReplies((prev) => ({ ...prev, [c.id]: REPLY_INITIAL }))}
                  className="text-xs font-black underline decoration-2 underline-offset-4"
                >
                  Collapse
                </button>
              )
            )}
          </div>
        )}

        {replyTo === c.id && currentUser && (
          <form onSubmit={(e) => void postReply(e, c.id)} className="mt-3 flex gap-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">
                Reply to {replyTarget ? replyTarget.authorName : "comment"}
              </span>
              <input
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                maxLength={500}
                autoFocus
                placeholder={`Reply to ${replyTarget ? replyTarget.authorName : "comment"}…`}
                className="toon-input py-2 text-sm"
              />
            </label>
              <Button
                variant="secondary"
                size="small"
              type="submit"
                disabled={replying || !replyBody.trim()}
                className="shrink-0"
              >
                {replying ? "…" : "Reply"}
              </Button>
          </form>
        )}
        {replyTo === c.id && replyError && (
          <p role="alert" className="mt-2 text-sm font-bold">
            {replyError}
          </p>
        )}
      </li>
    );
  };

  return (
    <div>
      {loading ? (
        <p className="text-sm font-bold text-muted">Loading feedback…</p>
      ) : topLevel.length ? (
        <ul className="space-y-3">{topLevel.map((c) => renderNode(c, 0))}</ul>
      ) : (
        <p className="text-sm font-bold text-muted">
          No feedback yet. Be the first to share something useful.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm font-bold">
          {error}
        </p>
      )}
      {stickyForm ? (
        <div className="sticky bottom-0 -mx-4 -mb-4 mt-4 border-t-2 border-dashed border-divider bg-surface p-4">
          {form}
        </div>
      ) : (
        <div className="mt-4">{form}</div>
      )}
    </div>
  );
}
