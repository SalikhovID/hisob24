// initials are the letters an avatar shows for a name: the first letter (or
// digit) of each of its first two words. A note in brackets is not the name,
// and quotes or dashes are no letters; a name with nothing left has none.
export function initials(name: string | null | undefined): string | null {
  const letters = (name ?? "")
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .split(/\s+/)
    .map((word) => word.match(/[\p{L}\p{N}]/u)?.[0])
    .filter((letter) => letter !== undefined)
  if (letters.length === 0) return null
  return letters.slice(0, 2).join("").toUpperCase()
}

// TONES is how many tints the avatars have (the Avatar holds their classes).
export const TONES = 5

// tone is the tint of whoever a seed (a phone, an ID) stands for: the same
// seed always gets the same one.
export function tone(seed: string | number): number {
  let hash = 0
  for (const char of String(seed)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return hash % TONES
}
