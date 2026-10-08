import notificationUrl from "../../soundEffects/Notification.mp3";
import votingUrl from "../../soundEffects/Voting.mp3";

// Bundled via Vite asset imports (typed by vite/client), so the files work
// from dev, preview, and any deployment base path with hashed filenames.
// Elements are created lazily on first play (always inside a user gesture or
// after interaction, satisfying browser autoplay policies). Play failures
// (e.g. audio blocked) are swallowed — sound is decoration, never load-bearing.
const elements = new Map<string, HTMLAudioElement>();

const MUTE_KEY = "cc.sounds.muted.v1";

let muted = false;
try {
  muted = localStorage.getItem(MUTE_KEY) === "1";
} catch {
  // Storage unavailable — sounds stay on for the session.
}

/** Device-level mute for vote/notification chimes. Persisted. */
export function isSoundsMuted(): boolean {
  return muted;
}

export function setSoundsMuted(mute: boolean): void {
  muted = mute;
  try {
    localStorage.setItem(MUTE_KEY, mute ? "1" : "0");
  } catch {
    // Non-fatal.
  }
}

function play(url: string): void {
  if (muted) return;
  try {
    let el = elements.get(url);
    if (!el) {
      el = new Audio(url);
      el.preload = "auto";
      elements.set(url, el);
    }
    el.currentTime = 0;
    void el.play().catch(() => undefined);
  } catch {
    // Audio unavailable (SSR, old browser) — stay silent.
  }
}

/** Successful upvote toggle (Discover cards + project page). */
export function playVoteSound(): void {
  play(votingUrl);
}

/** Unread notification count grew while the app is open. */
export function playNotificationSound(): void {
  play(notificationUrl);
}
