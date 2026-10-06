import type { Profile } from "../data/types";

/** Extract collaborator profile ids from @Name mentions (exact name match). */
export function extractMentionIds(text: string, profiles: Profile[]): string[] {
  const byLower = new Map<string, Profile>();
  for (const p of profiles) {
    const key = p.name.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, p);
  }
  const seen = new Set<string>();
  const ids: string[] = [];
  const re = /@([A-Za-z][A-Za-z .'-]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const token = m[1].replace(/[ .'-]+$/, "").trim();
    if (!token) continue;
    const hit = byLower.get(token.toLowerCase());
    if (hit && !seen.has(hit.id)) {
      seen.add(hit.id);
      ids.push(hit.id);
    }
  }
  return ids;
}
