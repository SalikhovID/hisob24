// rowParts are what a row of a group says (components/kit/group.tsx): its
// title, the line under it and its end (the value with the line under it),
// as the row draws them; null where there is none.
export function rowParts(row: HTMLElement): { title: string | null; sub: string | null; end: string | null } {
  const text = (slot: string) => row.querySelector(`[data-slot="${slot}"]`)?.textContent ?? null
  return { title: text("row-title"), sub: text("row-sub"), end: text("row-end") }
}
