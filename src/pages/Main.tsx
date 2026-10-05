import React from "react";
import { useAuth } from "../auth/AuthProvider";
import Login from "./Login";
import Store from "./Store";
import Home from "./Home";

export default function Main() {
  const { user } = useAuth();
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  if (user)
    return (
      <main className="min-h-screen">
        <Store />
      </main>
    );
  if (["/signin", "/store", "/dashboard", "/apps", "/builders", "/community"].includes(path))
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
