import React, { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import About from "./About";
import Login from "./Login";
import Store from "./Store";
import Home from "./Home";

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

  if (loading)
    return (
      <main className="grid min-h-screen place-items-center">
        <div className="font-loader" role="status" aria-label="Loading CodeCanvas">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </main>
    );
  if (path === "/about")
    return (
      <main className="min-h-screen">
        <About />
      </main>
    );
  if (user)
    return (
      <main className="min-h-screen">
        <Store key={path} />
      </main>
    );
  if (
    ["/signin", "/store", "/dashboard", "/apps", "/builders", "/community", "/leaderboard", "/profile", "/developers", "/projects"].includes(
      path,
    ) ||
    path.startsWith("/builders/") ||
    path.startsWith("/developers/") ||
    path.startsWith("/apps/") ||
    path.startsWith("/projects/") ||
    path.startsWith("/store/")
  )
    return (
      <main className="min-h-screen">
        <Login />
      </main>
    );
  return (
    <main className="min-h-screen">
      <Home />
    </main>
  );
}
