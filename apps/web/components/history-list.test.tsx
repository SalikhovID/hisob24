import { render, screen, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { formatDateTime } from "@/lib/format"
import type { CustomerHistoryEntry } from "@/lib/types"
import { HistoryList } from "./history-list"

const edit: CustomerHistoryEntry = {
  id: 2,
  action: "updated",
  actor_name: "Ali Valiyev",
  created_at: "2026-10-02T06:02:00.000Z",
  changes: [
    { label: "INN", old: "301234567", new: "301234568" },
    { label: "Manba", old: "", new: "Instagram" },
  ],
}
const entry: CustomerHistoryEntry = { id: 1, action: "created", actor_name: null, created_at: "2026-10-02T06:01:00.000Z", changes: [] }

// slot reads the text of one part of an entry.
const slot = (item: HTMLElement, name: string) => item.querySelector(`[data-slot="${name}"]`)?.textContent

test("every entry says what was done, by whom and when, the latest first", () => {
  render(<HistoryList label="Tarix" entries={[edit, entry]} />)

  const items = within(screen.getByRole("list", { name: "Tarix" })).getAllByRole("listitem")
  expect(items.map((item) => [slot(item, "history-action"), slot(item, "history-actor"), slot(item, "history-time")])).toEqual([
    ["Tahrirlandi", "Ali Valiyev", formatDateTime(edit.created_at)],
    // A member who went by no name.
    ["Qo'shildi", "—", formatDateTime(entry.created_at)],
  ])
})

test("an edit lists each change: the field, and its value before and after, a dash where there was none", () => {
  render(<HistoryList label="Tarix" entries={[edit, entry]} />)

  const [edited, created] = within(screen.getByRole("list", { name: "Tarix" })).getAllByRole("listitem")
  const changes = Array.from(edited.querySelectorAll('[data-slot="history-change"]')).map((change) => [
    slot(change as HTMLElement, "change-label"),
    slot(change as HTMLElement, "change-old"),
    slot(change as HTMLElement, "change-new"),
  ])
  expect(changes).toEqual([
    ["INN", "301234567", "301234568"],
    ["Manba", "—", "Instagram"],
  ])
  // Before and after are said in words for a screen reader.
  expect(edited).toHaveTextContent("avval: 301234567")
  expect(edited).toHaveTextContent("keyin: 301234568")
  expect(created.querySelector('[data-slot="history-change"]')).toBeNull()
})
