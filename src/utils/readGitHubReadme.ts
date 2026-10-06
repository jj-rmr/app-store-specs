import { validateMarkdownText } from "./readMarkdownFile";

const MAX_README_BYTES = 200_000;

function getGitHubRepository(url: string): { owner: string; repo: string } | null {
  try {
    const parsed = new URL(url);
    if (
      (parsed.protocol !== "https:" && parsed.protocol !== "http:") ||
      !["github.com", "www.github.com"].includes(parsed.hostname.toLowerCase())
    ) {
      return null;
    }

    const [owner, rawRepo] = parsed.pathname.split("/").filter(Boolean);
    const repo = rawRepo?.replace(/\.git$/i, "");
    if (!owner || !repo || owner === "orgs" || owner === "organizations") return null;

    return { owner, repo };
  } catch {
    return null;
  }
}

export function isGitHubRepositoryUrl(url: string): boolean {
  return getGitHubRepository(url) !== null;
}

async function readResponseText(response: Response): Promise<string> {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_README_BYTES) {
    throw new Error("The repository README is too large to display (200KB maximum).");
  }

  if (!response.body) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > MAX_README_BYTES) {
      throw new Error("The repository README is too large to display (200KB maximum).");
    }
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let byteLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > MAX_README_BYTES) {
        await reader.cancel();
        throw new Error("The repository README is too large to display (200KB maximum).");
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

export async function readGitHubReadme(url: string, signal: AbortSignal): Promise<string | null> {
  const repository = getGitHubRepository(url);
  if (!repository) return null;

  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}/readme`,
    {
      headers: { Accept: "application/vnd.github.raw+json" },
      signal,
    },
  );
  if (response.status === 404) return null;
  if (!response.ok) {
    if (response.status === 403 || response.status === 429) {
      throw new Error("GitHub could not load the README right now. Try again later.");
    }
    throw new Error(`GitHub could not load the README (HTTP ${response.status}).`);
  }

  return validateMarkdownText("README.md", await readResponseText(response)).text;
}
