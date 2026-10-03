// initials are the letters an avatar shows for a name: the first letters of
// its first two words.
export function initials(name: string | null | undefined): string | null {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return null
  return words
    .slice(0, 2)
    .map((word) => Array.from(word)[0])
    .join("")
    .toUpperCase()
}
