"use client"

import { ArrowRightIcon } from "lucide-react"
import { Failed, ListLoading } from "@/components/states"
import { formatDateTime } from "@/lib/format"
import { useCustomerHistory } from "@/lib/queries"
import type { CustomerHistoryEntry } from "@/lib/types"

// What an entry says was done to the customer.
const actions: Record<CustomerHistoryEntry["action"], string> = {
  created: "Qo'shildi",
  updated: "Tahrirlandi",
  deleted: "O'chirildi",
}

// A value of the history, a dash where there was none.
const shown = (value: string) => (value === "" ? "—" : value)

// CustomerHistory is what happened to a customer, for the company's owner,
// the latest first: who did it and when, and for an edit each field that
// changed, before and after. The values are text as it was then: a field or
// an option renamed since reads here under its old name.
export function CustomerHistory({ companyId, id }: { companyId: number; id: number }) {
  const history = useCustomerHistory(companyId, id)
  return (
    <section aria-labelledby="customer-history" className="space-y-3">
      <h2 id="customer-history" className="text-base font-semibold">
        Tarix
      </h2>
      {history.isPending && <ListLoading rows={2} mark="none" />}
      {history.isError && <Failed error={history.error} onRetry={() => history.refetch()} />}
      {history.data && (
        <ol aria-label="Tarix" className="divide-y rounded-xl border bg-card tabular-nums">
          {history.data.map((entry) => (
            <li key={entry.id} className="px-4 py-3 text-sm">
              <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span data-slot="history-action" className="font-medium">
                  {actions[entry.action]}
                </span>
                <span className="text-[0.8125rem] leading-5 text-muted-foreground">
                  <span data-slot="history-actor">{entry.actor_name ?? "—"}</span>
                  {", "}
                  <span data-slot="history-time" className="whitespace-nowrap">
                    {formatDateTime(entry.created_at)}
                  </span>
                </span>
              </p>
              {entry.changes.length > 0 && (
                <dl className="mt-2 grid gap-1.5">
                  {/* By their place: two changes may go by one name (the
                      phone, and a field the owner named "Telefon"). */}
                  {entry.changes.map((change, place) => (
                    <div
                      key={place}
                      data-slot="history-change"
                      className="grid gap-x-4 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]"
                    >
                      <dt data-slot="change-label" className="text-[0.8125rem] leading-5 text-muted-foreground [overflow-wrap:anywhere]">
                        {change.label}
                      </dt>
                      <dd className="min-w-0 [overflow-wrap:anywhere]">
                        <span className="sr-only">avval: </span>
                        <span data-slot="change-old" className="text-muted-foreground">
                          {shown(change.old)}
                        </span>
                        <ArrowRightIcon aria-hidden="true" className="mx-1.5 inline size-3.5 align-[-0.125em] text-muted-foreground" />
                        <span className="sr-only">keyin: </span>
                        <span data-slot="change-new">{shown(change.new)}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
