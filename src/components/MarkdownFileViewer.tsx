import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BookOpenText, FileText, UploadSimple, X } from "@phosphor-icons/react";
import { Button, ButtonLabel } from "./Button";
import Markdown from "./Markdown";
import { readMarkdownFile } from "../utils/readMarkdownFile";

type MarkdownFileViewerProps = {
  initialDocument?: { name: string; text: string };
  buttonLabel?: string;
};

export default function MarkdownFileViewer({
  initialDocument,
  buttonLabel = "Open a Markdown file",
}: MarkdownFileViewerProps) {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(initialDocument?.name ?? null);
  const [text, setText] = useState(initialDocument?.text ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setFileName(initialDocument?.name ?? null);
    setText(initialDocument?.text ?? "");
    setError(null);
  }, [initialDocument?.name, initialDocument?.text]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const loadFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      const markdown = await readMarkdownFile(file);
      setFileName(markdown.name);
      setText(markdown.text);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read that file.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="surface"
        type="button"
        onClick={() => setOpen(true)}
      >
        <BookOpenText size={20} weight="duotone" />
        {buttonLabel}
      </Button>
      {open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${inputId}-title`}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-ink/80 p-3 sm:p-6"
          >
            <section
              onClick={(event) => event.stopPropagation()}
              className="toon-card paper-note my-auto flex max-h-[90vh] min-h-[min(28rem,80vh)] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-paper"
            >
              <header className="flex shrink-0 items-center justify-between gap-4 border-b-[3px] border-ink bg-surface px-4 py-3 sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <BookOpenText size={26} weight="duotone" aria-hidden="true" />
                  <div className="min-w-0">
                    <h2 id={`${inputId}-title`} className="text-lg font-black sm:text-xl">
                      Markdown file viewer
                    </h2>
                    {fileName && (
                      <p className="truncate text-sm font-bold text-muted" title={fileName}>
                        {fileName}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close Markdown file viewer"
                  className="shrink-0 rounded-full border-2 border-ink bg-surface p-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow"
                >
                  <X size={18} weight="bold" />
                </button>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-7">
                <div className="mb-5 flex flex-wrap items-center gap-3">
                  <input
                    id={inputId}
                    type="file"
                    accept=".md,.markdown,.txt,text/markdown,text/plain"
                    disabled={loading}
                    className="peer sr-only"
                    onChange={(event) => {
                      void loadFile(event.currentTarget.files?.[0]);
                      event.currentTarget.value = "";
                    }}
                  />
                  <ButtonLabel
                    variant="secondary"
                    htmlFor={inputId}
                    className="cursor-pointer text-sm peer-focus-visible:outline-none peer-focus-visible:ring-4 peer-focus-visible:ring-yellow"
                  >
                    <UploadSimple size={19} weight="bold" aria-hidden="true" />
                    {loading ? "Opening…" : fileName ? "Open another file" : "Choose a file"}
                  </ButtonLabel>
                  <p className="text-sm font-bold text-muted">
                    Markdown, .txt, and plain-text README files up to 50,000 characters.
                  </p>
                </div>

                {error && (
                  <p
                    role="alert"
                    className="mb-4 rounded-lg border-2 border-ink bg-pink/30 p-3 font-bold"
                  >
                    {error}
                  </p>
                )}

                {text ? (
                  <article className="rounded-lg border-2 border-ink bg-surface p-4 sm:p-6">
                    <div className="mb-4 flex items-center gap-2 border-b-2 border-dashed border-divider pb-3 text-sm font-black uppercase text-muted">
                      <FileText size={19} weight="duotone" aria-hidden="true" />
                      Document
                    </div>
                    <Markdown text={text} className="md-doc--viewer" />
                  </article>
                ) : (
                  <div className="flex min-h-56 flex-col items-center justify-center rounded-lg border-2 border-dashed border-divider bg-surface/70 px-5 py-10 text-center">
                    <BookOpenText size={40} weight="duotone" aria-hidden="true" />
                    <h3 className="mt-3 text-xl font-black">
                      {loading ? "Reading your file…" : "Your document will appear here"}
                    </h3>
                    <p className="mt-1 max-w-md text-sm font-bold text-muted">
                      Choose a Markdown file to format headings, lists, links, code, tables, and
                      more.
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
