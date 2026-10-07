import React, { useState } from "react";
import { GoogleOAuthProvider, useGoogleLogin, type TokenResponse } from "@react-oauth/google";
import { ArrowLeft, ArrowRight, LockKey, Sparkle } from "@phosphor-icons/react";
import { useAuth } from "../auth/AuthProvider";
import Brand from "../components/Brand";
import { Button } from "../components/Button";
import { getProfileRepo } from "../data/factory";
import type { GoogleAccount } from "../data/repositories";

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

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
  const { signin, signinWithGoogleAccount } = useAuth();
  const [email, setEmail] = useState("student@example.com");
  const [password, setPassword] = useState("Password123");
  const [error, setError] = useState<string | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (await signin(email, password)) window.history.replaceState({}, "", "/store");
    else setError("That email and password don't match.");
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
            <h2 className="text-2xl font-black">Sign in</h2>
            <LockKey size={25} weight="duotone" className="text-purple" />
          </div>
          <form onSubmit={submit} className="space-y-5">
            <label className="block">
              <span className="toon-label">Email address</span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="email"
                className="toon-input"
                required
              />
            </label>
            <label className="block">
              <span className="toon-label">Password</span>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                className="toon-input"
                required
              />
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
              Continue <ArrowRight size={20} weight="bold" />
            </Button>
          </form>
          <div className="my-6 flex items-center gap-3 text-xs font-black uppercase text-muted">
            <span className="h-0.5 flex-1 rounded bg-divider" aria-hidden="true" />
            or continue with
            <span className="h-0.5 flex-1 rounded bg-divider" aria-hidden="true" />
          </div>
          {googleClientId ? (
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
          <div className="mt-7 rounded-2xl border-2 border-dashed border-ink bg-cream p-4 text-sm leading-6">
            <span className="font-black">Demo account:</span> student@example.com · Password123
          </div>
        </div>
      </div>
    </div>
  );
}
