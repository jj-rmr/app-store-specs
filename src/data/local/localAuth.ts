import { MOCK_USERS } from "../../auth/mockCredentials";
import { AuthError, type AuthRepo, type GoogleAccount, type GoogleSignInResult } from "../repositories";
import type { User } from "../types";

const SESSION_KEY = "cc.session.v1";
const NAMES_KEY = "cc.display_names.v1";
const GOOGLE_USERS_KEY = "cc.google_users.v1";

function loadGoogleUsers(): Record<string, { id: string; email: string; name: string }> {
  try {
    const raw = localStorage.getItem(GOOGLE_USERS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, { id: string; email: string; name: string }>;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function delay(ms = 120): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function toUser(found: { id: string; email: string; name: string }): User {
  return { id: found.id, email: found.email, name: found.name };
}

function loadNameOverrides(): Record<string, string> {
  try {
    const raw = localStorage.getItem(NAMES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function applyOverride(user: User): User {
  const custom = loadNameOverrides()[user.id]?.trim();
  return custom ? { ...user, name: custom } : user;
}

export function createLocalAuthRepo(): AuthRepo {
  return {
    async getSession(): Promise<User | null> {
      await delay(80);
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw) as User;
        if (!parsed?.id || !parsed?.email) throw new Error("bad session");
        return applyOverride(parsed);
      } catch {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
    },

    async signin(email: string, password: string): Promise<User> {
      await delay();
      const normalizedEmail = email.trim().toLowerCase();
      const found = MOCK_USERS.find(
        (u) => u.email.toLowerCase() === normalizedEmail && u.password === password,
      );
      if (!found) throw new AuthError();
      const user = applyOverride(toUser(found));
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      return user;
    },

    async signinWithGoogleAccount(account: GoogleAccount): Promise<GoogleSignInResult> {
      await delay();
      const subject = account.sub.trim();
      const email = account.email.trim();
      if (!subject || !email) throw new AuthError("That Google sign-in was invalid. Try again.");
      const normalizedEmail = email.toLowerCase();
      const stored = loadGoogleUsers();
      // Link to the existing account when this verified Google email already owns one,
      // so the user automatically lands on their existing profile (still editable).
      // Unverified emails always get a separate account to prevent impersonation.
      let id = `google-${subject}`;
      let name = (account.name.trim() || email.split("@")[0]).slice(0, 40);
      if (account.emailVerified === true) {
        const mockMatch = MOCK_USERS.find((u) => u.email.toLowerCase() === normalizedEmail);
        const googleMatch = Object.values(stored).find(
          (record) => record.email.toLowerCase() === normalizedEmail,
        );
        if (mockMatch) {
          id = mockMatch.id;
          name = mockMatch.name;
        } else if (googleMatch) {
          id = googleMatch.id;
          name = googleMatch.name;
        }
      }
      const known = stored[subject];
      const record = { id, email, name: known?.name ?? name };
      localStorage.setItem(GOOGLE_USERS_KEY, JSON.stringify({ ...stored, [subject]: record }));
      const user = applyOverride({ id, email, name: record.name });
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      return { user, picture: account.picture };
    },

    async signout(): Promise<void> {
      await delay(60);
      localStorage.removeItem(SESSION_KEY);
    },

    async updateName(name: string): Promise<User> {
      await delay(80);
      const clean = name.trim();
      if (!clean) throw new Error("Name is required.");
      if (clean.length > 40) throw new Error("Keep your name under 40 characters.");
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) throw new Error("You are not signed in.");
      const session = JSON.parse(raw) as User;
      const updated: User = { ...session, name: clean };
      localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
      const overrides = loadNameOverrides();
      localStorage.setItem(NAMES_KEY, JSON.stringify({ ...overrides, [session.id]: clean }));
      return updated;
    },
  };
}
