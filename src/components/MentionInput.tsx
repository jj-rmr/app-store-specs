import React, { useMemo, useRef, useState } from "react";
import Avatar from "./Avatar";
import Input from "./Input";
import type { Profile } from "../data/types";

type MentionInputProps = {
  value: string;
  onChange: (value: string) => void;
  profiles: Profile[];
  placeholder?: string;
  maxLength?: number;
  required?: boolean;
  className?: string;
};

/** Single-line input with @developer autocomplete (filters as you type). */
export default function MentionInput({
  value,
  onChange,
  profiles,
  placeholder,
  maxLength,
  required,
  className,
}: MentionInputProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [anchor, setAnchor] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    // One row per display name: same-named accounts are the same mention target.
    const unique = new Map<string, Profile>();
    for (const p of profiles) {
      const key = p.name.toLowerCase();
      if (!unique.has(key)) unique.set(key, p);
    }
    const score = (p: Profile) => {
      const n = p.name.toLowerCase();
      if (!q) return 3;
      if (n === q) return 0;
      if (n.startsWith(q)) return 1;
      if (n.includes(q)) return 2;
      return 4;
    };
    return [...unique.values()]
      .filter((p) => (q ? score(p) < 4 : true))
      .sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name))
      .slice(0, 8);
  }, [profiles, query]);

  // The list shrinks as you type; never point past its end.
  const activeIndex = suggestions.length ? Math.min(highlight, suggestions.length - 1) : 0;

  const syncMention = (text: string, cursor: number | null | undefined) => {
    if (cursor === null || cursor === undefined) {
      setOpen(false);
      return;
    }
    const match = /(?:^|\s)@([A-Za-z .'-]*)$/.exec(text.slice(0, cursor));
    if (match) {
      setQuery(match[1]);
      setAnchor(cursor - match[1].length - 1);
      setHighlight(0);
      setOpen(true);
    } else {
      setOpen(false);
    }
  };

  const complete = (name: string) => {
    const cursor = inputRef.current?.selectionStart ?? value.length;
    const start = anchor ?? cursor;
    const next = `${value.slice(0, start)}@${name} ${value.slice(cursor)}`;
    onChange(next);
    setOpen(false);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      const pos = start + name.length + 2;
      inputRef.current?.setSelectionRange(pos, pos);
    });
  };

  return (
    <span className="relative block">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          syncMention(e.target.value, e.target.selectionStart);
        }}
        onClick={(e) => syncMention(value, e.currentTarget.selectionStart)}
        onKeyUp={(e) => {
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key))
            syncMention(value, e.currentTarget.selectionStart);
        }}
        onKeyDown={(e) => {
          if (!open || suggestions.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => (h + 1) % suggestions.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
          } else if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            complete(suggestions[activeIndex].name);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        placeholder={placeholder}
        maxLength={maxLength}
        required={required}
        autoComplete="off"
        className={className}
      />
      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          aria-label="Developer suggestions"
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border-[3px] border-ink bg-surface p-1.5 shadow-[4px_4px_0_var(--color-ink)]"
        >
          {suggestions.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === activeIndex}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  complete(p.name);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-black ${i === activeIndex ? "bg-yellow" : ""}`}
              >
                <Avatar name={p.name} color={p.color} imageUrl={p.imageUrl} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate">{p.name}</span>
                  <span className="block truncate text-xs font-bold text-muted">{p.role}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}
