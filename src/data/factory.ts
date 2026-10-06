import type { AppRepo, AuthRepo, ProfileRepo } from "./repositories";
import { createLocalAppRepo } from "./local/localApps";
import { createLocalAuthRepo } from "./local/localAuth";
import { createLocalProfileRepo } from "./local/localProfiles";

// VITE_DATA_SOURCE=local (default) | http (future real backend).
// UI must only depend on these interfaces, never on localStorage/fetch directly.
const source = import.meta.env.VITE_DATA_SOURCE ?? "local";

let authRepo: AuthRepo | null = null;
let appRepo: AppRepo | null = null;
let profileRepo: ProfileRepo | null = null;

export function getAuthRepo(): AuthRepo {
  if (!authRepo) {
    if (source !== "local") {
      // Future: return createHttpAuthRepo(baseUrl)
      throw new Error(`Unknown data source: ${source}`);
    }
    authRepo = createLocalAuthRepo();
  }
  return authRepo;
}

export function getAppRepo(): AppRepo {
  if (!appRepo) {
    if (source !== "local") {
      // Future: return createHttpAppRepo(baseUrl)
      throw new Error(`Unknown data source: ${source}`);
    }
    appRepo = createLocalAppRepo();
  }
  return appRepo;
}

export function getProfileRepo(): ProfileRepo {
  if (!profileRepo) {
    if (source !== "local") {
      // Future: return createHttpProfileRepo(baseUrl)
      throw new Error(`Unknown data source: ${source}`);
    }
    profileRepo = createLocalProfileRepo();
  }
  return profileRepo;
}
