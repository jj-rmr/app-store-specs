type BrandProps = {
  light?: boolean;
  compact?: boolean;
  className?: string;
};

export default function Brand({ light = false, compact = false, className = "" }: BrandProps) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <svg
        viewBox="0 0 48 48"
        className="h-11 w-11 shrink-0 rotate-[-4deg] drop-shadow-[3px_3px_0_var(--color-ink)]"
        aria-hidden="true"
      >
        <path
          d="M7 3h34l4 5v32l-5 5H8l-5-5V8l4-5Z"
          fill="var(--color-yellow)"
          stroke="var(--color-ink)"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path
          d="M10 8h28l2 3v26l-3 3H11l-3-3V11l2-3Z"
          fill="none"
          stroke="var(--color-purple)"
          strokeWidth="1.5"
          strokeDasharray="3 3"
          strokeLinecap="round"
        />
        <path
          d="M17 24a7 7 0 1 1 14 0c0 3-2 4-3.5 6H20.5C19 28 17 27 17 24Z"
          fill="var(--color-paper)"
          stroke="var(--color-ink)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path
          d="M21 34h6M22 38h4"
          stroke="var(--color-ink)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M24 11v3M13 17l3 2M35 17l-3 2"
          stroke="var(--color-purple)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      {!compact && (
        <div className="flex flex-col gap-0">
          <span className={`font-display text-xl font-bold ${light ? "text-surface" : "text-ink"}`}>
            Code<span className={light ? "text-yellow" : "text-purple"}>Canvas</span>
          </span>
          <span className={`-mt-1 text-xs font-black ${light ? "text-yellow" : "text-purple"}`}>
            by SPECS
          </span>
        </div>
      )}
    </span>
  );
}
