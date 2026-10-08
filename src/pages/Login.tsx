import React, { useState } from "react";
import { GoogleOAuthProvider, useGoogleLogin, type TokenResponse } from "@react-oauth/google";
import { ArrowLeft, ArrowRight, Eye, EyeSlash, LockKey, Sparkle } from "@phosphor-icons/react";
import { useAuth } from "../auth/AuthProvider";
import Brand from "../components/Brand";
import { Button } from "../components/Button";
import Input from "../components/Input";
import { getProfileRepo } from "../data/factory";
import { getSupabase } from "../data/supabase/client";
import type { GoogleAccount } from "../data/repositories";

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const isSupabaseMode = (import.meta.env.VITE_DATA_SOURCE as string | undefined) === "supabase";

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="h-5 w-5 shrink-0">
      <path
        fill="#FFC107"
        d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.7l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"
      />
    </svg>
  );
}

function GoogleContinueButton({
  disabled,
  onAccount,
  onError,
}: {
  disabled: boolean;
  onAccount: (account: GoogleAccount) => void;
  onError: (message: string) => void;
}) {
  const login = useGoogleLogin({
    flow: "implicit",
    scope: "openid email profile",
    onSuccess: async (token: TokenResponse) => {
      try {
        const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${token.access_token}` },
        });
        if (!response.ok) throw new Error("profile fetch failed");
        const info = (await response.json()) as {
          sub?: string;
          email?: string;
          name?: string;
          picture?: string;
          email_verified?: boolean;
        };
        if (!info.sub || !info.email) throw new Error("incomplete profile");
        onAccount({
          sub: info.sub,
          email: info.email,
          name: info.name ?? "",
          picture: info.picture,
          emailVerified: info.email_verified,
          accessToken: token.access_token,
        });
      } catch {
        onError("Could not read your Google profile. Try again.");
      }
    },
    onError: () => onError("Google sign-in failed. Try again."),
  });
  return (
    <button
      type="button"
      onClick={() => login()}
      disabled={disabled}
      className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#1e1e1e] px-5 py-3.5 text-base font-semibold text-white transition hover:bg-black disabled:opacity-60"
    >
      <GoogleMark />
      {disabled ? "Connecting…" : "Continue with Google"}
    </button>
  );
}

export default function Login() {
  const { signin, signup, signinWithGoogleAccount } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const failure = await signup(name, email, password);
        if (failure) setError(failure);
        else window.history.replaceState({}, "", "/store");
      } else if (await signin(email, password)) {
        window.history.replaceState({}, "", "/store");
      } else {
        setError("That email and password don't match.");
      }
    } finally {
      setBusy(false);
    }
  };
  // Supabase mode uses the OAuth redirect flow (Supabase Auth handles the
  // session); local mode uses the GIS popup and signs in with the profile.
  const supabaseGoogle = async () => {
    setGoogleBusy(true);
    setGoogleError(null);
    try {
      const { error } = await getSupabase().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/store` },
      });
      if (error) throw error;
    } catch (e) {
      setGoogleError(e instanceof Error ? e.message : "Google sign-in failed. Try again.");
      setGoogleBusy(false);
    }
  };
  const onGoogleAccount = async (account: GoogleAccount) => {
    setGoogleBusy(true);
    setGoogleError(null);
    const result = await signinWithGoogleAccount(account);
    if (!result.ok || !result.user) {
      setGoogleError(result.error ?? "Google sign-in failed. Try again.");
      setGoogleBusy(false);
      return;
    }
    try {
      await getProfileRepo().ensureUserProfile(result.user);
    } catch {
      // Non-fatal: the profile syncs on the next app load.
    }
    window.history.replaceState({}, "", "/store");
  };

  return (
    <div className="relative grid min-h-screen place-items-center px-5 py-14">
      <a href="/" className="absolute left-5 top-6 flex items-center gap-2 font-black sm:left-10">
        <ArrowLeft size={20} weight="bold" />
        Home
      </a>
      <Sparkle
        size={90}
        weight="duotone"
        className="absolute -right-5 top-16 rotate-12 text-pink"
        aria-hidden="true"
      />
      <div className="w-full max-w-md">
        <div className="mb-7 text-center">
          <Brand className="mb-6" />
          <h1 className="mt-2 text-3xl font-black">Sign in to CodeCanvas</h1>
          <p className="mt-2 text-muted">Access projects shared by the SPECS community.</p>
        </div>
        <div className="toon-card paper-note rounded-lg bg-surface p-7 pt-10 sm:p-9 sm:pt-11">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-black">
              {mode === "signup" ? "Create account" : "Sign in"}
            </h2>
            <LockKey size={25} weight="duotone" className="text-purple" />
          </div>
          <div className="mb-5 flex gap-2" role="tablist" aria-label="Sign in or create account">
            {(["signin", "signup"] as const).map((tab) => (
              <button
                key={tab}
                role="tab"
                aria-selected={mode === tab}
                onClick={() => {
                  setMode(tab);
                  setError(null);
                }}
                className={`flex-1 rounded-md border-2 border-ink px-3 py-2 text-sm font-black ${mode === tab ? "bg-purple text-surface" : "bg-surface"}`}
              >
                {tab === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>
          <form onSubmit={submit} className="space-y-5">
            {mode === "signup" && (
              <label className="block">
                <span className="toon-label">Display name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  type="text"
                  autoComplete="nickname"
                  maxLength={40}
                  placeholder="What should we call you?"
                  className="toon-input"
                  required
                />
              </label>
            )}
            <label className="block">
              <span className="toon-label">Email address</span>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="off"
                className="toon-input"
                required
              />
            </label>
            <label className="block">
              <span className="toon-label">Password</span>
              <span className="relative block">
                <Input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={mode === "signup" ? 6 : undefined}
                  placeholder={mode === "signup" ? "At least 6 characters" : "Enter your password"}
                  className="toon-input pr-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                >
                  {showPassword ? (
                    <EyeSlash size={21} weight="bold" />
                  ) : (
                    <Eye size={21} weight="bold" />
                  )}
                </button>
              </span>
            </label>
            {error && (
              <p
                role="alert"
                className="rounded-xl border-[3px] border-ink bg-pink/50 px-4 py-3 text-sm font-bold"
              >
                {error}
              </p>
            )}
            <Button type="submit" fullWidth>
              {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Continue"}{" "}
              <ArrowRight size={20} weight="bold" />
            </Button>
          </form>
          <div className="my-6 flex items-center gap-3 text-xs font-black uppercase text-muted">
            <span className="h-0.5 flex-1 rounded bg-divider" aria-hidden="true" />
            or continue with
            <span className="h-0.5 flex-1 rounded bg-divider" aria-hidden="true" />
          </div>
          {isSupabaseMode ? (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void supabaseGoogle()}
                disabled={googleBusy}
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#1e1e1e] px-5 py-3.5 text-base font-semibold text-white transition hover:bg-black disabled:opacity-60"
              >
                <GoogleMark />
                {googleBusy ? "Connecting…" : "Continue with Google"}
              </button>
              {googleError && (
                <p
                  role="alert"
                  className="w-full rounded-xl border-[3px] border-ink bg-pink/50 px-4 py-3 text-sm font-bold"
                >
                  {googleError}
                </p>
              )}
            </div>
          ) : googleClientId ? (
            <div className="flex flex-col gap-2">
              <GoogleOAuthProvider clientId={googleClientId}>
                <GoogleContinueButton
                  disabled={googleBusy}
                  onAccount={(account) => void onGoogleAccount(account)}
                  onError={setGoogleError}
                />
              </GoogleOAuthProvider>
              {googleError && (
                <p
                  role="alert"
                  className="w-full rounded-xl border-[3px] border-ink bg-pink/50 px-4 py-3 text-sm font-bold"
                >
                  {googleError}
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-ink bg-cream p-4 text-sm leading-6">
              <span className="font-black">Google sign-in not configured.</span> To enable it,
              create a Web OAuth client ID in Google Cloud Console, add it as{" "}
              <code className="rounded bg-ink px-1.5 py-0.5 text-xs text-surface">
                VITE_GOOGLE_CLIENT_ID
              </code>{" "}
              in <code className="rounded bg-ink px-1.5 py-0.5 text-xs text-surface">.env</code>,
              then restart the dev server. See .env.example.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
