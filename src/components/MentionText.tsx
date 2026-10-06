import React from "react";
import type { Profile } from "../data/types";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type MentionTextProps = {
  text: string;
  profiles: Profile[];
  onOpenProfile: (profileId: string) => void;
};

/** Renders @Developer mentions as tappable profile links. Unknown names stay plain. */
export default function MentionText({ text, profiles, onOpenProfile }: MentionTextProps) {
  const names = profiles
    .map((p) => p.name)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  if (!names.length || !text.includes("@")) return <>{text}</>;
  const byLower = new Map(profiles.map((p) => [p.name.toLowerCase(), p]));
  const parts = text.split(new RegExp(`(@(?:${names.map(escapeRegExp).join("|")}))`, "gi"));
  return (
    <>
      {parts.map((part, i) => {
        const hit = part.startsWith("@") ? byLower.get(part.slice(1).toLowerCase()) : undefined;
        if (!hit) return <React.Fragment key={i}>{part}</React.Fragment>;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onOpenProfile(hit.id)}
            title={`View ${hit.name}'s profile`}
            className="font-black text-purple underline decoration-2 underline-offset-4"
          >
            @{hit.name}
          </button>
        );
      })}
    </>
  );
}
