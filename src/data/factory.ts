import type { AppRepo, AuthRepo, ProfileRepo } from "./repositories";
import { createLocalAppRepo } from "./local/localApps";
import { createLocalAuthRepo } from "./local/localAuth";
import { createLocalProfileRepo } from "./local/localProfiles";
import {
  createHttpAppRepo,
  createHttpAuthRepo,
  createHttpProfileRepo,
} from "./http/httpRepos";
import {
  createSupabaseAppRepo,
  createSupabaseAuthRepo,
  createSupabaseProfileRepo,
} from "./supabase/supabaseRepos";

// VITE_DATA_SOURCE=local (default, browser localStorage) | supabase | http.
// UI must only depend on these interfaces, never on localStorage/fetch directly.
// Switching sources needs no UI edits; see BACKEND_READINESS.md for what each
// source requires.
const source = import.meta.env.VITE_DATA_SOURCE ?? "local";

let authRepo: AuthRepo | null = null;
let appRepo: AppRepo | null = null;
let profileRepo: ProfileRepo | null = null;

export function getAuthRepo(): AuthRepo {
  if (!authRepo) {
    if (source === "http") authRepo = createHttpAuthRepo();
    else if (source === "supabase") authRepo = createSupabaseAuthRepo();
    else if (source === "local") authRepo = createLocalAuthRepo();
    else throw new Error(`Unknown data source: ${source}`);
  }
  return authRepo;
}

export function getAppRepo(): AppRepo {
  if (!appRepo) {
    if (source === "http") appRepo = createHttpAppRepo();
    else if (source === "supabase") appRepo = createSupabaseAppRepo();
    else if (source === "local") appRepo = createLocalAppRepo();
    else throw new Error(`Unknown data source: ${source}`);
  }
  return appRepo;
}

export function getProfileRepo(): ProfileRepo {
  if (!profileRepo) {
    if (source === "http") profileRepo = createHttpProfileRepo();
    else if (source === "supabase") profileRepo = createSupabaseProfileRepo();
    else if (source === "local") profileRepo = createLocalProfileRepo();
    else throw new Error(`Unknown data source: ${source}`);
  }
  return profileRepo;
}
