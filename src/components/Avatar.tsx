type AvatarProps = {
  name: string;
  color: string;
  imageUrl?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
};

const sizes = {
  sm: "h-8 w-8 text-xs",
  md: "h-14 w-14 text-lg",
  lg: "h-20 w-20 text-2xl",
  xl: "h-32 w-32 text-4xl",
} as const;

export function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function Avatar({ name, color, imageUrl, size = "md", className = "" }: AvatarProps) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={`${name}'s profile`}
        loading="lazy"
        className={`${sizes[size]} shrink-0 rounded-full border-[3px] border-ink object-cover ${className}`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      style={{ backgroundColor: `var(--color-${color})` }}
      className={`grid ${sizes[size]} shrink-0 place-items-center rounded-full border-[3px] border-ink font-black ${className}`}
    >
      {initials(name)}
    </span>
  );
}
