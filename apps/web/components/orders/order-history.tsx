"use client"

import { HistoryList } from "@/components/history-list"
import { Failed, ListLoading } from "@/components/states"
import { useOrderHistory } from "@/lib/queries"

// OrderHistory is what happened to an order, for the company's owner, the
// latest first: it was entered, edited, moved or deleted.
export function OrderHistory({ companyId, id }: { companyId: number; id: number }) {
  const history = useOrderHistory(companyId, id)
  return (
    <section aria-labelledby="order-history" className="space-y-3">
      <h2 id="order-history" className="text-base font-semibold">
        Tarix
      </h2>
      {history.isPending && <ListLoading rows={2} mark="none" />}
      {history.isError && <Failed error={history.error} onRetry={() => history.refetch()} />}
      {history.data && <HistoryList label="Tarix" entries={history.data} />}
    </section>
  )
}
