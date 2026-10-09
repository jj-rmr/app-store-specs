import React, { useMemo, useState } from "react";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import Avatar from "./Avatar";
import Input from "./Input";
import type { Profile } from "../data/types";

type CollaboratorPickerProps = {
  profiles: Profile[];
  selected: string[];
  onChange: (selected: string[]) => void;
};

/** Explicit collaborators box: search developers, tick to add, chip to remove. */
export default function CollaboratorPicker({
  profiles,
  selected,
  onChange,
}: CollaboratorPickerProps) {
  const [filter, setFilter] = useState("");
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const unique = useMemo(() => {
    const seen = new Map<string, Profile>();
    for (const p of profiles) {
      const key = p.name.toLowerCase();
      if (!seen.has(key)) seen.set(key, p);
    }
    return [...seen.values()];
  }, [profiles]);

  const q = filter.trim().toLowerCase();
  const matches = unique
    .filter((p) => !q || p.name.toLowerCase().includes(q))
    .sort((a, b) => {
      const rank = (p: Profile) => (!q ? 1 : p.name.toLowerCase().startsWith(q) ? 0 : 1);
      return rank(a) - rank(b) || a.name.localeCompare(b.name);
    })
    .slice(0, 8);

  const toggle = (id: string) => {
    onChange(selectedSet.has(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };

  const selectedProfiles = selected
    .map((id) => unique.find((p) => p.id === id))
    .filter((p): p is Profile => Boolean(p));

  return (
    <div className="rounded-2xl border-[3px] border-ink bg-surface p-3">
      {selectedProfiles.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {selectedProfiles.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-yellow py-0.5 pl-0.5 pr-1.5 text-xs font-black"
            >
              <Avatar name={p.name} color={p.color} imageUrl={p.imageUrl} size="sm" />
              {p.name}
              <button
                type="button"
                onClick={() => toggle(p.id)}
                aria-label={`Remove ${p.name} as collaborator`}
                className="rounded-full border border-ink bg-surface p-0.5"
              >
                <X size={12} weight="bold" />
              </button>
            </span>
          ))}
        </div>
      )}
      <label className="relative block">
        <span className="sr-only">Search developers to add as collaborators</span>
        <MagnifyingGlass
          size={18}
          weight="bold"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        />
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search developers…"
          autoComplete="off"
          className="py-2 pl-10 text-sm"
          variant="ghost"
        />
      </label>
      <ul className="mt-2 max-h-52 space-y-1 overflow-y-auto">
        {matches.map((p) => {
          const checked = selectedSet.has(p.id);
          return (
            <li key={p.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-black hover:bg-cream">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(p.id)}
                  className="h-4 w-4 shrink-0 accent-purple"
                />
                <Avatar name={p.name} color={p.color} imageUrl={p.imageUrl} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate">{p.name}</span>
                  <span className="block truncate text-xs font-bold text-muted">{p.role}</span>
                </span>
              </label>
            </li>
          );
        })}
        {matches.length === 0 && (
          <li className="px-2 py-1.5 text-sm font-bold text-muted">No developers match.</li>
        )}
      </ul>
    </div>
  );
}
