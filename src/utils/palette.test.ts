import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadPalette, PALETTES, resolvePalette, setPalette } from "./palette";
import { SITE_PALETTE_IDS } from "../data/types";

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
});

beforeEach(() => {
  store.clear();
});

describe("palettes", () => {
  it("offers a full shelf with preview swatches", () => {
    expect(PALETTES.length).toBeGreaterThanOrEqual(6);
    for (const p of PALETTES) {
      expect(p.id).toBeTruthy();
      expect(p.swatches.length).toBeGreaterThanOrEqual(4);
    }
  });

  it("defaults to candy and rejects unknown ids", () => {
    expect(loadPalette()).toBe("candy");
    setPalette("ocean");
    expect(loadPalette()).toBe("ocean");
    setPalette("nope");
    expect(loadPalette()).toBe("candy");
  });

  it("covers every contract id exactly once", () => {
    expect(PALETTES.map((p) => p.id).sort()).toEqual([...SITE_PALETTE_IDS].sort());
  });

  it("prefers the account palette, falls back to device", () => {
    setPalette("forest");
    expect(resolvePalette("midnight")).toBe("midnight");
    expect(resolvePalette(undefined)).toBe("forest");
    expect(resolvePalette(null)).toBe("forest");
    expect(resolvePalette("")).toBe("forest");
    expect(resolvePalette("nope")).toBe("forest");
    store.clear();
    expect(resolvePalette(undefined)).toBe("candy");
  });
});
