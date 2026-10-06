"use client"

import { HistoryList } from "@/components/history-list"
import { Failed, ListLoading } from "@/components/states"
import { useCustomerHistory } from "@/lib/queries"

// CustomerHistory is what happened to a customer, for the company's owner,
// the latest first.
export function CustomerHistory({ companyId, id }: { companyId: number; id: number }) {
  const history = useCustomerHistory(companyId, id)
  return (
    <section aria-labelledby="customer-history" className="space-y-3">
      <h2 id="customer-history" className="text-base font-semibold">
        Tarix
      </h2>
      {history.isPending && <ListLoading rows={2} mark="none" />}
      {history.isError && <Failed error={history.error} onRetry={() => history.refetch()} />}
      {history.data && <HistoryList label="Tarix" entries={history.data} />}
    </section>
  )
}
