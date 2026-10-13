import { ArrowRightIcon } from "lucide-react"
import { formatDateTime } from "@/lib/format"

// HistoryEntry is one thing that happened to a record: what was done, by
// whom (null for a member who went by no name) and when, and for an edit
// each field that changed, before and after, as text.
export interface HistoryEntry {
  id: number
  action: "created" | "updated" | "deleted"
  actor_name: string | null
  created_at: string
  changes: { label: string; old: string; new: string }[]
}

// What an entry says was done to the record.
const actions: Record<HistoryEntry["action"], string> = {
  created: "Qo'shildi",
  updated: "Tahrirlandi",
  deleted: "O'chirildi",
}

// A value of the history, a dash where there was none.
const shown = (value: string) => (value === "" ? "—" : value)

// HistoryList is what happened to a record, the latest first: who did it and
// when, and for an edit each field that changed, before and after. The
// values are text as it was then: a field or an option renamed since reads
// here under its old name.
export function HistoryList({ label, entries }: { label: string; entries: HistoryEntry[] }) {
  return (
    <ol aria-label={label} className="overflow-hidden rounded-group bg-card tabular-nums">
      {entries.map((entry) => (
        <li key={entry.id} className="relative px-4 py-3 text-md not-first:before:absolute not-first:before:top-0 not-first:before:right-0 not-first:before:left-4 not-first:before:h-[0.5px] not-first:before:bg-border not-first:before:content-['']">
          <p className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
            <span data-slot="history-action" className="font-semibold">
              {actions[entry.action]}
            </span>
            <span className="text-right text-xs leading-5 text-muted-foreground">
              <span data-slot="history-actor">{entry.actor_name ?? "—"}</span>
              {", "}
              <span data-slot="history-time" className="whitespace-nowrap">
                {formatDateTime(entry.created_at)}
              </span>
            </span>
          </p>
          {entry.changes.length > 0 && (
            <dl className="mt-1.5 grid gap-1 text-sm text-muted-foreground">
              {/* By their place: two changes may go by one name (the
                  phone, and a field the owner named "Telefon"). */}
              {entry.changes.map((change, place) => (
                <div
                  key={place}
                  data-slot="history-change"
                  className="min-w-0 [overflow-wrap:anywhere]"
                >
                  <dt data-slot="change-label" className="inline font-medium text-foreground after:content-[':_']">
                    {change.label}
                  </dt>
                  <dd className="inline">
                    <span className="sr-only">avval: </span>
                    <span data-slot="change-old" className="text-muted-foreground">
                      {shown(change.old)}
                    </span>
                    <ArrowRightIcon aria-hidden="true" className="mx-1.5 inline size-3.5 align-[-0.125em] text-muted-foreground" />
                    <span className="sr-only">keyin: </span>
                    <span data-slot="change-new" className="text-foreground">{shown(change.new)}</span>
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </li>
      ))}
    </ol>
  )
}
