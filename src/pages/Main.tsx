import React, { Suspense, lazy, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";

// Route-split: each page (and its heavy deps like markdown/GitHub readers)
// loads on demand instead of inflating the first paint.
const About = lazy(() => import("./About"));
const Login = lazy(() => import("./Login"));
const Store = lazy(() => import("./Store"));
const Landing = lazy(() => import("./Landing"));

function PageLoader() {
  return (
    <main className="grid min-h-screen place-items-center">
      <div className="font-loader" role="status" aria-label="Loading CodeCanvas">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </main>
  );
}

function currentPath() {
  return window.location.pathname.replace(/\/$/, "") || "/";
}

export default function Main() {
  const { user, loading } = useAuth();
  const [path, setPath] = useState(currentPath());

  useEffect(() => {
    const onPopState = () => setPath(currentPath());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (loading) return;

    const current = currentPath();
    const destination = user
      ? current === "/" || current === "/signin"
        ? "/store"
        : null
      : current === "/"
        ? "/landing"
        : current === "/store" || current.startsWith("/store/")
          ? "/signin"
          : null;

    if (destination) {
      window.history.replaceState({}, "", destination);
      setPath(destination);
    }
  }, [loading, path, user]);

  if (loading) return <PageLoader />;

  let page: React.ReactNode;
  if (path === "/about") page = <About />;
  else if (path === "/landing" || (path === "/" && !user)) page = <Landing />;
  else if (user) page = <Store key={path} />;
  else if (
    [
      "/signin",
      "/store",
      "/dashboard",
      "/apps",
      "/builders",
      "/feed",
      "/community",
      "/leaderboard",
      "/profile",
      "/developers",
      "/projects",
      "/settings",
    ].includes(path) ||
    path.startsWith("/builders/") ||
    path.startsWith("/developers/") ||
    path.startsWith("/apps/") ||
    path.startsWith("/projects/") ||
    path.startsWith("/store/")
  )
    page = <Login />;
  else page = <Landing />;

  return (
    <main className="min-h-screen">
      <Suspense fallback={<PageLoader />}>{page}</Suspense>
    </main>
  );
}
