import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Heart, X } from "@phosphor-icons/react";
import Avatar from "./Avatar";
import { getAppRepo } from "../data/factory";
import type { Profile } from "../data/types";

type VotersDialogProps = {
  appId: string;
  appTitle: string;
  totalVotes: number;
  onOpenProfile: (profileId: string) => void;
};

/**
 * Underlined "Voters" trigger above the vote button + floating box with
 * every voter's avatar and name. Both avatar and name open that voter's
 * profile. The list is fetched lazily on open so cards stay cheap.
 */
export default function VotersDialog({
  appId,
  appTitle,
  totalVotes,
  onOpenProfile,
}: VotersDialogProps) {
  const [open, setOpen] = useState(false);
  const [voters, setVoters] = useState<Profile[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getAppRepo()
      .listVoters(appId)
      .then((list) => {
        if (!cancelled) setVoters(list);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load voters.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, appId, attempt]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const goProfile = (profileId: string) => {
    setOpen(false);
    onOpenProfile(profileId);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={
          totalVotes === 1
            ? "See who upvoted (1 upvote)"
            : `See who upvoted (${totalVotes} upvotes)`
        }
        className="text-xs font-bold text-muted underline decoration-2 underline-offset-4 hover:text-ink"
      >
        Voters
      </button>

      {open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Voters for ${appTitle}`}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-100 flex items-center justify-center overflow-y-auto bg-ink/80 p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="toon-card my-auto flex max-h-[85vh] min-h-0 w-full max-w-md flex-col overflow-hidden rounded-lg bg-surface"
            >
              <div className="flex shrink-0 items-center justify-between gap-3 border-b-[3px] border-ink p-4">
                <h4 className="flex min-w-0 items-center gap-2 truncate text-lg font-black">
                  <Heart size={20} weight="duotone" aria-hidden="true" />
                  <span className="truncate">
                    Upvoted by{voters !== null && ` (${voters.length})`}
                  </span>
                </h4>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close voters"
                  autoFocus
                  className="shrink-0 rounded-full border-2 border-ink bg-surface p-1.5"
                >
                  <X size={16} weight="bold" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
                {loading ? (
                  <p className="text-sm font-bold text-muted">Loading voters…</p>
                ) : error ? (
                  <div className="text-center">
                    <p role="alert" className="text-sm font-bold">
                      {error}
                    </p>
                    <button
                      type="button"
                      onClick={() => setAttempt((n) => n + 1)}
                      className="mt-3 text-sm font-black underline decoration-2 underline-offset-4"
                    >
                      Try again
                    </button>
                  </div>
                ) : voters !== null && voters.length > 0 ? (
                  <>
                    <ul className="space-y-1">
                      {voters.map((v) => (
                        <li key={v.id}>
                          <span className="flex w-full items-center gap-3 rounded-xl border-2 border-transparent p-2 hover:border-ink hover:bg-cream">
                            <button
                              type="button"
                              onClick={() => goProfile(v.id)}
                              aria-label={`View ${v.name}'s profile`}
                              className="shrink-0 rounded-full"
                            >
                              <Avatar
                                name={v.name}
                                color={v.color}
                                imageUrl={v.imageUrl}
                                size="sm"
                              />
                            </button>
                            <button
                              type="button"
                              onClick={() => goProfile(v.id)}
                              className="min-w-0 flex-1 truncate text-left text-sm font-black underline decoration-2 underline-offset-4"
                            >
                              {v.name}
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                    {totalVotes > voters.length && (
                      <p className="mt-3 text-center text-xs font-bold text-muted">
                        {totalVotes} total upvotes · {voters.length} voter
                        {voters.length === 1 ? "" : "s"} shown (older upvotes predate voter
                        tracking).
                      </p>
                    )}
                  </>
                ) : totalVotes > 0 ? (
                  <p className="text-center text-sm font-bold text-muted">
                    {totalVotes} upvote{totalVotes === 1 ? "" : "s"}, but voter names aren&apos;t
                    available for older upvotes.
                  </p>
                ) : (
                  <p className="text-center text-sm font-bold text-muted">
                    No upvotes yet. Be the first to vote.
                  </p>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
