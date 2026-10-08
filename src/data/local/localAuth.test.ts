import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLocalAuthRepo } from "./localAuth";

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
});
vi.stubGlobal("window", { setTimeout: setTimeout.bind(globalThis) });

beforeEach(() => {
  store.clear();
});

describe("duplicate emails", () => {
  it("rejects a manual signup reusing an existing email", async () => {
    const auth = createLocalAuthRepo();
    await auth.signup("Ann", "ann@example.com", "secret123");
    await expect(auth.signup("Someone Else", "ann@example.com", "secret123")).rejects.toThrow(
      "That email is already registered. Sign in instead.",
    );
    // Case-insensitive: same address, different casing.
    await expect(auth.signup("Someone Else", "ANN@example.com", "secret123")).rejects.toThrow(
      "That email is already registered. Sign in instead.",
    );
  });

  it("rejects a manual signup reusing a Google-linked email", async () => {
    const auth = createLocalAuthRepo();
    await auth.signinWithGoogleAccount({
      sub: "g-1",
      email: "mia@example.com",
      name: "Mia",
      emailVerified: true,
    });
    await expect(auth.signup("Mia Clone", "mia@example.com", "secret123")).rejects.toThrow(
      "That email is already registered. Sign in instead.",
    );
  });

  it("still signs the original owner in after a duplicate attempt", async () => {
    const auth = createLocalAuthRepo();
    const created = await auth.signup("Ann", "ann@example.com", "secret123");
    await expect(auth.signup("Intruder", "ann@example.com", "different1")).rejects.toThrow(
      "already registered",
    );
    const session = await auth.signin("ann@example.com", "secret123");
    expect(session).toMatchObject({ id: created.id, email: "ann@example.com", name: "Ann" });
  });
});
