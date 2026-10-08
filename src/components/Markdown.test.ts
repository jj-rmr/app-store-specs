import { describe, expect, it } from "vitest";
import { sanitizeMarkdownUrl } from "./Markdown";

describe("sanitizeMarkdownUrl", () => {
  it("passes http, https, mailto, and relative targets through untouched", () => {
    expect(sanitizeMarkdownUrl("https://example.com/x")).toBe("https://example.com/x");
    expect(sanitizeMarkdownUrl("http://example.com")).toBe("http://example.com");
    expect(sanitizeMarkdownUrl("mailto:a@b.com")).toBe("mailto:a@b.com");
    expect(sanitizeMarkdownUrl("/apps/123")).toBe("/apps/123");
    expect(sanitizeMarkdownUrl("#section")).toBe("#section");
    expect(sanitizeMarkdownUrl("docs/guide.md")).toBe("docs/guide.md");
  });

  it("neutralizes script-capable protocols (case-insensitive, padded)", () => {
    expect(sanitizeMarkdownUrl("javascript:alert(1)")).toBe("#");
    expect(sanitizeMarkdownUrl("JaVaScRiPt:alert(1)")).toBe("#");
    expect(sanitizeMarkdownUrl("  javascript:alert(1)")).toBe("#");
    expect(sanitizeMarkdownUrl("data:text/html,<script>alert(1)</script>")).toBe("#");
    expect(sanitizeMarkdownUrl("vbscript:msgbox(1)")).toBe("#");
  });

  it("handles missing targets", () => {
    expect(sanitizeMarkdownUrl(undefined)).toBe("#");
  });
});
