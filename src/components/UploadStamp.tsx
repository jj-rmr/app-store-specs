import { Clock } from "@phosphor-icons/react";
import { formatUploadStamp } from "../utils/time";

type UploadStampProps = {
  createdAt?: string;
  /**
   * Override what's displayed (and exposed via <time>): the moment this
   * became news (e.g. a tag/vote arrival) instead of the content date.
   * Tooltip then comes from titleText.
   */
  displayAt?: string;
  /** Full tooltip wording. Defaults to "Uploaded <full date>". */
  titleText?: string;
  className?: string;
};

/**
 * Single source of truth for the "when uploaded" stamp.
 * Shows relative time under 24h, calendar date afterwards.
 * Full timestamp is always available via title tooltip + <time>.
 */
export default function UploadStamp({
  createdAt,
  displayAt,
  titleText,
  className = "",
}: UploadStampProps) {
  const source = displayAt ?? createdAt;
  if (!source) return null;
  const stamp = formatUploadStamp(source);
  if (!stamp) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-bold text-muted ${className}`.trim()}
      title={titleText ?? `Uploaded ${stamp.title}`}
    >
      <Clock size={14} weight="duotone" aria-hidden="true" />
      <time dateTime={stamp.dateTime}>{stamp.text}</time>
    </span>
  );
}
