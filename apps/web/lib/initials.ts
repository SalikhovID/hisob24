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

// shortName is a name as the prototype says it where room is short (the
// home's head, a card): the first word and the next one's first letter.
export function shortName(name: string): string {
  const [first = "", second] = name.trim().split(/\s+/)
  return second ? `${first} ${second.charAt(0)}.` : first
}

// AVATAR_COLORS are the prototype's avatar colors, white initials on each.
export const AVATAR_COLORS = ["#c98f6e", "#6f9b7d", "#7b86c7", "#c47a9e", "#8c9ab0", "#c2a35a"] as const

// avatarColor is the color a name's avatar wears, as the prototype hashes it
// (its quotes dropped): the same name always gets the same one.
export function avatarColor(name: string): string {
  let hash = 0
  for (const char of name.replace(/["']/g, "")) hash = (hash * 31 + char.charCodeAt(0)) % 9973
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

// firstLetter is the letter the prototype's avatar shows: the name's first
// letter (or digit), upper case; none for a name without one.
export function firstLetter(name: string | null | undefined): string | null {
  return (name ?? "").match(/[\p{L}\p{N}]/u)?.[0]?.toUpperCase() ?? null
}
