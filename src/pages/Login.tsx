import React, { useState } from "react";
import { ArrowLeft, ArrowRight, LockKey, Sparkle } from "@phosphor-icons/react";
import { useAuth } from "../auth/AuthProvider";
import { Button } from "../components/Button";
import Brand from "../components/Brand";
import Input from "../components/Input";

export default function Login() {
  const { signin } = useAuth();
  const [email, setEmail] = useState("student@example.com");
  const [password, setPassword] = useState("Password123");
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (await signin(email, password)) window.history.replaceState({}, "", "/store");
    else setError("That email and password don't match.");
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
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="email"
                required
              />
            </label>
            <label className="block">
              <span className="toon-label">Password</span>
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
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
          <div className="mt-7 rounded-2xl border-2 border-dashed border-ink bg-cream p-4 text-sm leading-6">
            <span className="font-black">Demo account:</span> student@example.com · Password123
          </div>
        </div>
      </div>
    </div>
  );
}
