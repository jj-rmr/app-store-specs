import { validateMarkdownText } from "./readMarkdownFile";

const MAX_README_BYTES = 200_000;

type GitHubRepository = { owner: string; repo: string };
type GitHubTreeEntry = { path: string; type: string };

function isGitHubTreeEntry(entry: unknown): entry is GitHubTreeEntry {
  return (
    typeof entry === "object" &&
    entry !== null &&
    "path" in entry &&
    typeof entry.path === "string" &&
    "type" in entry &&
    typeof entry.type === "string"
  );
}

function getGitHubRepository(url: string): GitHubRepository | null {
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

async function getGitHubDefaultBranch(
  repository: GitHubRepository,
  signal: AbortSignal,
): Promise<string> {
  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}`,
    { headers: { Accept: "application/vnd.github+json" }, signal },
  );
  if (!response.ok) {
    if (response.status === 403 || response.status === 429) {
      throw new Error("GitHub could not load repository files right now. Try again later.");
    }
    throw new Error(`GitHub could not load the repository (HTTP ${response.status}).`);
  }
  const metadata: unknown = await response.json();
  if (
    typeof metadata !== "object" ||
    metadata === null ||
    !("default_branch" in metadata) ||
    typeof metadata.default_branch !== "string"
  ) {
    throw new Error("GitHub returned invalid repository information.");
  }
  return metadata.default_branch;
}

export async function listGitHubMarkdownFiles(url: string, signal: AbortSignal): Promise<string[]> {
  const repository = getGitHubRepository(url);
  if (!repository) throw new Error("Enter a public GitHub repository URL first.");

  const branch = await getGitHubDefaultBranch(repository, signal);
  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    { headers: { Accept: "application/vnd.github+json" }, signal },
  );
  if (!response.ok) {
    if (response.status === 403 || response.status === 429) {
      throw new Error("GitHub could not list repository files right now. Try again later.");
    }
    throw new Error(`GitHub could not list repository files (HTTP ${response.status}).`);
  }

  const tree: unknown = await response.json();
  if (typeof tree !== "object" || tree === null || !("tree" in tree) || !Array.isArray(tree.tree)) {
    throw new Error("GitHub returned an invalid repository file list.");
  }
  if ("truncated" in tree && tree.truncated === true) {
    throw new Error("This repository has too many files to list completely.");
  }

  return tree.tree
    .filter(isGitHubTreeEntry)
    .filter((entry) => entry.type === "blob" && /\.(?:md|markdown|mdown|mkd)$/i.test(entry.path))
    .map((entry) => entry.path)
    .sort((a, b) => a.localeCompare(b));
}

export async function readGitHubMarkdownFiles(
  url: string,
  paths: string[],
  signal: AbortSignal,
): Promise<Array<{ path: string; text: string }>> {
  const repository = getGitHubRepository(url);
  if (!repository) throw new Error("Enter a public GitHub repository URL first.");

  const branch = await getGitHubDefaultBranch(repository, signal);
  const encodedBranch = encodeURIComponent(branch);

  const files: Array<{ path: string; text: string } | undefined> = new Array(paths.length);
  let nextIndex = 0;
  const readNext = async () => {
    while (nextIndex < paths.length) {
      const index = nextIndex++;
      const path = paths[index];
      const encodedPath = path.split("/").map(encodeURIComponent).join("/");
      const response = await fetch(
        `https://raw.githubusercontent.com/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}/${encodedBranch}/${encodedPath}`,
        { signal },
      );
      if (!response.ok) {
        throw new Error(`Could not download ${path} from GitHub (HTTP ${response.status}).`);
      }
      files[index] = {
        path,
        text: validateMarkdownText(path, await readResponseText(response), MAX_README_BYTES).text,
      };
    }
  };
  await Promise.all(Array.from({ length: Math.min(paths.length, 5) }, () => readNext()));
  return files.filter((file): file is { path: string; text: string } => file !== undefined);
}

async function readResponseText(response: Response): Promise<string> {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_README_BYTES) {
    throw new Error("The repository Markdown file is too large (200KB maximum).");
  }

  if (!response.body) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > MAX_README_BYTES) {
      throw new Error("The repository Markdown file is too large (200KB maximum).");
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
        throw new Error("The repository Markdown file is too large (200KB maximum).");
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
