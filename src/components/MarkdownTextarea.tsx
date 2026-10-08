import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";
import { getInputClassName } from "./Input";

type MarkdownTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  value: string;
};

export default function MarkdownTextarea({
  className = "",
  value,
  ...props
}: MarkdownTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const borderHeight = textarea.offsetHeight - textarea.clientHeight;
    textarea.style.height = `${textarea.scrollHeight + borderHeight}px`;
  }, [value]);

  return (
    <textarea
      {...props}
      ref={textareaRef}
      value={value}
      className={getInputClassName(
        "default",
        `markdown-textarea resize-none overflow-y-auto ${className}`,
      )}
    />
  );
}
