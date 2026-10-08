import { useEffect, useState } from "react";
import { ArrowCounterClockwise, Palette, SpeakerHigh, SpeakerSlash } from "@phosphor-icons/react";
import { Button } from "./Button";
import { isSoundsMuted, playNotificationSound, setSoundsMuted } from "../utils/sounds";
import { loadPalette, PALETTES, resolvePalette, setPalette } from "../utils/palette";
import { getProfileRepo } from "../data/factory";
import { resetLocalData } from "../data/local/localApps";
import { useAuth } from "../auth/AuthProvider";
import type { Profile } from "../data/types";

const isLocalMode =
  ((import.meta.env.VITE_DATA_SOURCE as string | undefined) ?? "local") === "local";

/**
 * Device settings. Sound mute lives here (persisted per browser).
 * The demo-data reset only applies to the localStorage backend.
 */
export default function SettingsView({
  profile,
  onChanged,
}: {
  profile: Profile | null;
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const [muted, setMuted] = useState(() => isSoundsMuted());
  const [palette, setPaletteState] = useState(() => loadPalette());
  const [paletteError, setPaletteError] = useState<string | null>(null);
  const [paletteSaving, setPaletteSaving] = useState(false);
  const [armReset, setArmReset] = useState(false);

  // Follow the account choice when it arrives (e.g. fresh login on a new
  // device); otherwise keep the device choice.
  useEffect(() => {
    setPaletteState(resolvePalette(profile?.palette));
  }, [user?.id, profile?.palette]);

  const pickPalette = async (id: string) => {
    const previous = loadPalette();
    setPalette(id);
    setPaletteState(loadPalette());
    setPaletteError(null);
    if (!user) return;
    setPaletteSaving(true);
    try {
      await getProfileRepo().updateProfile(user.id, { palette: id }, user.id);
      onChanged();
    } catch (e) {
      setPalette(previous);
      setPaletteState(previous);
      setPaletteError(e instanceof Error ? e.message : "Could not save palette.");
    } finally {
      setPaletteSaving(false);
    }
  };

  const toggleMute = () => {
    const next = !muted;
    setSoundsMuted(next);
    setMuted(next);
    // Confirm unmuting audibly; muting stays silent by definition.
    if (!next) playNotificationSound();
  };

  const resetDemo = () => {
    resetLocalData();
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      <section className="toon-card paper-note rounded-lg p-6 pt-10 sm:p-8 sm:pt-12">
        <div className="flex items-center gap-2">
          <Palette size={22} weight="duotone" aria-hidden="true" />
          <h2 className="text-2xl font-black">Website theme</h2>
        </div>
        <p className="mt-2 text-sm font-bold text-muted">
          Recolor the whole site to your taste. Saved to your account, so it follows you to other
          browsers.
        </p>
        {paletteError && (
          <p role="alert" className="mt-2 text-sm font-bold">
            {paletteError}
          </p>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-2" role="group" aria-label="Website theme">
          {PALETTES.map((p) => {
            const active = palette === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => void pickPalette(p.id)}
                disabled={paletteSaving}
                aria-pressed={active}
                className={`flex items-center gap-3 rounded-xl border-[3px] p-3 text-left ${active ? "border-ink bg-yellow shadow-[3px_3px_0_var(--color-ink)]" : "border-divider bg-surface hover:bg-cream"}`}
              >
                <span className="flex shrink-0 -space-x-1.5" aria-hidden="true">
                  {p.swatches.map((hex) => (
                    <span
                      key={hex}
                      style={{ backgroundColor: hex }}
                      className="h-6 w-6 rounded-full border-2 border-ink"
                    />
                  ))}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-black">{p.label}</span>
                  <span className="block text-xs font-bold text-muted">
                    {active ? "In use" : "Tap to apply"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>
      <section className="toon-card paper-note rounded-lg p-6 pt-10 sm:p-8 sm:pt-12">
        <div className="flex items-center gap-2">
          {muted ? (
            <SpeakerSlash size={22} weight="duotone" aria-hidden="true" />
          ) : (
            <SpeakerHigh size={22} weight="duotone" aria-hidden="true" />
          )}
          <h2 className="text-2xl font-black">Sounds</h2>
        </div>
        <p className="mt-2 text-sm font-bold text-muted">
          Chimes for upvotes and new notifications. Stored on this device only.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={!muted}
            aria-label="Sound effects"
            onClick={toggleMute}
            className={`flex w-16 items-center rounded-full border-[3px] border-ink p-1 ${muted ? "justify-start bg-divider" : "justify-end bg-mint"}`}
          >
            <span
              aria-hidden="true"
              className="h-6 w-6 rounded-full border-2 border-ink bg-surface"
            />
          </button>
          <span className="text-sm font-black">{muted ? "Muted" : "On"}</span>
          <Button
            variant="surface"
            size="small"
            type="button"
            onClick={() => playNotificationSound()}
            disabled={muted}
            title={muted ? "Unmute to preview" : "Preview the notification chime"}
            className="ml-auto"
          >
            Preview chime
          </Button>
        </div>
      </section>

      {isLocalMode && (
        <section className="toon-card paper-note rounded-lg p-6 pt-10 sm:p-8 sm:pt-12">
          <div className="flex items-center gap-2">
            <ArrowCounterClockwise size={22} weight="duotone" aria-hidden="true" />
            <h2 className="text-2xl font-black">Demo data</h2>
          </div>
          <p className="mt-2 text-sm font-bold text-muted">
            Clear locally stored projects, votes, feedback, and wall updates on this browser. Your
            account stays signed in.
          </p>
          {!armReset ? (
            <Button
              variant="surface"
              size="small"
              type="button"
              onClick={() => setArmReset(true)}
              className="mt-4"
            >
              Reset demo data
            </Button>
          ) : (
            <div role="alert" className="mt-4 rounded-xl border-2 border-dashed border-divider p-3">
              <p className="text-sm font-black">Clear all local projects and activity?</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <Button variant="danger" size="small" type="button" onClick={resetDemo}>
                  Yes, reset it
                </Button>
                <Button
                  variant="surface"
                  size="small"
                  type="button"
                  onClick={() => setArmReset(false)}
                >
                  Keep it
                </Button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
