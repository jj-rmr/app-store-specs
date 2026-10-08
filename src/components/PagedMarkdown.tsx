import { useEffect, useRef, useState } from "react";
import Markdown from "./Markdown";
import { Button } from "./Button";

type PagedMarkdownProps = {
  text: string;
  /** Visible height of the first chunk. */
  collapsedPx?: number;
  /** Extra pixels revealed per See more press. Never jumps to full. */
  stepPx?: number;
  /** Docs at or below this length render fully with no buttons. */
  limit?: number;
  /** Fade gradient target — match the surrounding card background. */
  fadeTo?: string;
};

/**
 * Stepped document pager: shows the first chunk, then reveals one part at a
 * time per See more press (never the full document at once). See less walks
 * back one part per press. Short docs render fully with no buttons.
 *
 * Height-clipping is used instead of slicing the markdown source so fenced
 * code blocks, tables, and lists never render half-broken mid-chunk.
 */
export default function PagedMarkdown({
  text,
  collapsedPx = 320,
  stepPx = 600,
  limit = 1000,
  fadeTo = "var(--color-paper)",
}: PagedMarkdownProps) {
  const long = text.length > limit;
  const [height, setHeight] = useState<number>(collapsedPx);
  const [hasMore, setHasMore] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHeight(collapsedPx);
  }, [text, collapsedPx]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el || !long) {
      setHasMore(false);
      return;
    }
    const check = () => setHasMore(el.scrollHeight > height + 24);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, height, long]);

  if (!long) {
    return <Markdown text={text} />;
  }

  const expanded = height > collapsedPx;
  const seeMore = () => setHeight((h) => h + stepPx);
  const seeLess = () => setHeight((h) => Math.max(collapsedPx, h - stepPx));

  return (
    <div>
      <div ref={contentRef} style={{ maxHeight: height }} className="relative overflow-hidden">
        <Markdown text={text} />
        {hasMore && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-24"
            style={{ background: `linear-gradient(to top, ${fadeTo}, transparent)` }}
          />
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {hasMore && (
          <Button
            variant="secondary"
            size="small"
            type="button"
            onClick={seeMore}
            aria-expanded={expanded}
          >
            See more
          </Button>
        )}
        {expanded && (
          <Button
            variant="surface"
            size="small"
            type="button"
            onClick={seeLess}
            aria-expanded={expanded}
          >
            See less
          </Button>
        )}
      </div>
    </div>
  );
}
