import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Renders user-supplied markdown as React elements (no dangerouslySetInnerHTML,
// raw HTML in the source is ignored), so pasted READMEs can't inject scripts.
export default function Markdown({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={`md-doc ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}
