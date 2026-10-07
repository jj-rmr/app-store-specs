import React, { useEffect, useState } from "react";
import { ArrowLeft, ChatCircleDots, Heart, Images, PencilSimple } from "@phosphor-icons/react";
import Avatar from "./Avatar";
import MentionText from "./MentionText";
import TrophyMark from "./TrophyMark";
import { Button, ButtonLabel } from "./Button";
import { useAuth } from "../auth/AuthProvider";
import { getAppRepo, getProfileRepo } from "../data/factory";
import { fileToThumbnailDataUrl } from "../utils/images";
import type { AppItem, Profile, User } from "../data/types";

type ProfileViewProps = {
  profileId: string;
  currentUser: User | null;
  trophies: Map<string, 1 | 2 | 3>;
  projectTrophies: Map<string, 1 | 2 | 3>;
  profiles: Map<string, Profile>;
  onBack: () => void;
  onOpenApp: (appId: string) => void;
  onOpenProfile: (profileId: string) => void;
};

const AVATAR_COLORS = ["pink", "yellow", "mint", "sky", "lavender", "purple"] as const;

export default function ProfileView({ profileId, currentUser, trophies, projectTrophies, profiles, onBack, onOpenApp, onOpenProfile }: ProfileViewProps) {
  const { updateName } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [apps, setApps] = useState<AppItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [bio, setBio] = useState("");
  const [color, setColor] = useState<string>("sky");
  const [imageUrl, setImageUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  const isSelf = currentUser ? profileId === currentUser.id : false;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const repo = getProfileRepo();
        const p =
          profileId === "__me__" && currentUser
            ? await repo.ensureUserProfile(currentUser)
            : await repo.getProfile(profileId);
        // Self-heal: ensure the signed-in user always has a row.
        if (currentUser && p.id !== currentUser.id) {
          await repo.ensureUserProfile(currentUser).catch(() => undefined);
        }
        const all = await getAppRepo().listApps({ limit: 200, userId: currentUser?.id });
        if (cancelled) return;
        setProfile(p);
        setName(p.name);
        setRole(p.role);
        setBio(p.bio);
        setColor(p.color);
        setImageUrl(p.imageUrl ?? "");
        setApps(
          all.filter((a) =>
            a.creatorId ? a.creatorId === p.id : a.creator.toLowerCase() === p.name.toLowerCase(),
          ),
        );
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load profile.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profileId, currentUser]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !currentUser || saving) return;
    setSaving(true);
    setSaveError(null);
    const previousName = profile.name;
    const nextName = name.trim();
    try {
      const updated = await getProfileRepo().updateProfile(
        profile.id,
        { name: nextName, role, bio, color, imageUrl },
        currentUser.id,
      );
      // Keep the sign-in session in sync so the new name survives reloads
      // and shows up in the sidebar immediately.
      if (isSelf && nextName !== currentUser.name) {
        try {
          await updateName(nextName);
        } catch {
          // Roll the profile back so the two never diverge.
          await getProfileRepo()
            .updateProfile(profile.id, { name: previousName }, currentUser.id)
            .catch(() => undefined);
          throw new Error("Could not update sign-in name. Try again.");
        }
      }
      setProfile(updated);
      setEditing(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not save profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="font-bold text-muted">Loading developer…</p>;
  if (error || !profile) {
    return (
      <div className="toon-card paper-note rounded-lg p-10 text-center">
        <h3 className="text-xl font-black">Developer not found</h3>
        <p className="font-bold text-muted">{error ?? "This profile does not exist."}</p>
        <Button variant="secondary" className="mt-5" onClick={onBack}>
          <ArrowLeft size={18} weight="bold" /> Back
        </Button>
      </div>
    );
  }

  const totalVotes = apps.reduce((n, a) => n + a.votes, 0);
  const totalFeedback = apps.reduce((n, a) => n + a.comments, 0);

  return (
    <div>
      <Button
        variant="surface"
        size="small"
        onClick={onBack}
      >
        <ArrowLeft size={18} weight="bold" /> Back to developers
      </Button>

      <div className="toon-card paper-note mt-5 rounded-lg p-6 pt-10 sm:p-8 sm:pt-12">
        <div className="flex flex-wrap items-start gap-5">
          <Avatar name={profile.name} color={profile.color} imageUrl={profile.imageUrl} size="xl" />
          <div className="min-w-0 flex-1">
            <p className="ink-stamp bg-surface">{isSelf ? "Your profile" : "Developer"}</p>
            <h2 className="mt-3 text-3xl font-black">
              {profile.name}
              {trophies.get(profile.id) !== undefined && (
                <TrophyMark place={trophies.get(profile.id) as 1 | 2 | 3} size={32} />
              )}
            </h2>
            <p className="mt-1 font-bold text-muted">{profile.role}</p>
            {profile.bio && <p className="mt-3 max-w-2xl leading-7 text-body">{profile.bio}</p>}
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm font-black">
              <span>
                {apps.length} project{apps.length === 1 ? "" : "s"}
              </span>
              <span className="flex items-center gap-1">
                <Heart size={16} weight="duotone" /> {totalVotes} votes received
              </span>
              <span className="flex items-center gap-1">
                <ChatCircleDots size={16} weight="duotone" /> {totalFeedback} feedback
              </span>
            </div>
          </div>
          {isSelf && (
            <Button
              variant="secondary"
              size="small"
              onClick={() => setEditing((v) => !v)}
            >
              <PencilSimple size={18} weight="bold" /> {editing ? "Close" : "Edit profile"}
            </Button>
          )}
        </div>

        {isSelf && editing && (
          <form onSubmit={(e) => void save(e)} className="mt-6 grid gap-4 border-t-2 border-dashed border-divider pt-6 sm:grid-cols-2">
            <label>
              <span className="toon-label">Display name</span>
              <input
                className="toon-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                required
                placeholder="e.g. Alex Reyes"
              />
            </label>
            <label>
              <span className="toon-label">Role</span>
              <input
                className="toon-input"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                maxLength={80}
                required
                placeholder="e.g. Frontend development"
              />
            </label>
            <label>
              <span className="toon-label">Avatar color</span>
              <select className="toon-input" value={color} onChange={(e) => setColor(e.target.value)}>
                {AVATAR_COLORS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="sm:col-span-2">
              <span className="toon-label">Bio (280 chars)</span>
              <input
                className="toon-input"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={280}
                placeholder="What do you build?"
              />
            </label>
            <label className="sm:col-span-2">
              <span className="toon-label">Profile photo</span>
              <span className="flex flex-wrap items-center gap-3">
                <ButtonLabel variant="surface" size="small" className="cursor-pointer">
                  <Images size={18} weight="duotone" />
                  {photoBusy ? "Processing…" : "Choose from gallery"}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={photoBusy || saving}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      setPhotoBusy(true);
                      setSaveError(null);
                      fileToThumbnailDataUrl(file, 256)
                        .then((dataUrl) => setImageUrl(dataUrl))
                        .catch((err) =>
                          setSaveError(err instanceof Error ? err.message : "Could not read photo."),
                        )
                        .finally(() => setPhotoBusy(false));
                    }}
                  />
                </ButtonLabel>
                {imageUrl && (
                  <button
                    type="button"
                    onClick={() => setImageUrl("")}
                    className="text-sm font-black underline decoration-2 underline-offset-4"
                  >
                    Remove photo
                  </button>
                )}
              </span>
              <input
                className="toon-input mt-3"
                type="url"
                value={imageUrl.startsWith("data:") ? "" : imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="…or paste an https:// image link"
              />
            </label>
            {imageUrl && (
              <div className="flex items-center gap-3 sm:col-span-2">
                <Avatar name={profile.name} color={color} imageUrl={imageUrl} size="sm" />
                <span className="text-sm font-bold text-muted">Preview</span>
              </div>
            )}
            {saveError && (
              <p role="alert" className="text-sm font-bold sm:col-span-2">
                {saveError}
              </p>
            )}
            <Button
              size="small"
              type="submit"
              disabled={saving}
              className="sm:justify-self-start"
            >
              {saving ? "Saving…" : "Save profile"}
            </Button>
          </form>
        )}
      </div>

      <div className="mb-5 mt-8 border-t-2 border-dashed border-divider pt-6">
        <p className="text-xs font-black uppercase text-purple">Projects</p>
        <h3 className="mt-1 text-2xl font-black">
          {isSelf ? "Your projects" : `Projects by ${profile.name}`}
        </h3>
      </div>
      {apps.length ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {apps.map((app) => (
            <button
              key={app.id}
              onClick={() => onOpenApp(app.id)}
              className="toon-card paper-note rounded-lg p-5 pt-9 text-left"
            >
              {app.screenshots?.[0] ? (
                <span className="relative block h-24 w-full overflow-hidden rounded-sm border-[3px] border-ink bg-ink">
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
                  className="project-cover flex h-24 items-center justify-center rounded-sm border-[3px] border-ink"
                >
                  <span className="rotate-[-4deg] text-3xl font-black">{app.title.charAt(0)}</span>
                </div>
              )}
              <p className="mt-4 text-[10px] font-black uppercase text-purple">{app.category}</p>
              <h4 className="text-lg font-black">
                {app.title}
                {projectTrophies.get(app.id) !== undefined && (
                  <TrophyMark place={projectTrophies.get(app.id) as 1 | 2 | 3} size={20} />
                )}
              </h4>
              <p className="mt-1 text-sm leading-6 text-muted">
                <MentionText
                  text={app.description}
                  profiles={[...profiles.values()]}
                  onOpenProfile={onOpenProfile}
                />
              </p>
              <p className="mt-3 flex items-center gap-4 text-sm font-black">
                <span className="flex items-center gap-1">
                  <Heart size={18} weight="duotone" /> {app.votes}
                </span>
                <span className="flex items-center gap-1">
                  <ChatCircleDots size={18} weight="duotone" /> {app.comments}
                </span>
              </p>
            </button>
          ))}
        </div>
      ) : (
        <div className="toon-card paper-note rounded-lg p-10 text-center">
          <h4 className="text-xl font-black">No projects yet</h4>
          <p className="font-bold text-muted">
            {isSelf ? "Submit your first project from Discover." : "Check back soon."}
          </p>
        </div>
      )}
    </div>
  );
}
