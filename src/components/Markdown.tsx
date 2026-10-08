import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Renders user-supplied markdown as React elements (no dangerouslySetInnerHTML,
// raw HTML in the source is ignored), so pasted READMEs can't inject scripts.
// Links are protocol-allowlisted below: react-markdown renders any href by
// default, including javascript:/data: payloads planted in imported READMEs.

/** hrefs that may never become clickable links. */
const BLOCKED_PROTOCOL = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

function isRelativeUrl(url: string): boolean {
  const clean = url.trim();
  if (clean === "" || clean.startsWith("/") || clean.startsWith("#")) return true;
  return !BLOCKED_PROTOCOL.test(clean);
}

/** Display URL for a markdown link target. Returns "#" for blocked protocols. */
export function sanitizeMarkdownUrl(url: string | undefined): string {
  if (url === undefined) return "#";
  const clean = url.trim();
  if (/^(https?:|mailto:)/i.test(clean)) return url;
  if (isRelativeUrl(clean)) return url;
  return "#";
}

export default function Markdown({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={`md-doc ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={sanitizeMarkdownUrl}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
