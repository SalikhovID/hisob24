"use client"

import { HistoryList } from "@/components/history-list"
import { Failed, ListLoading } from "@/components/states"
import { useTaskHistory } from "@/lib/queries"

// TaskHistory is what happened to a task, for the company's owner, the
// latest first: it was entered, edited, moved or deleted.
export function TaskHistory({ companyId, id }: { companyId: number; id: number }) {
  const history = useTaskHistory(companyId, id)
  return (
    <section aria-labelledby="task-history" className="space-y-3">
      <h2 id="task-history" className="text-base font-semibold">
        Tarix
      </h2>
      {history.isPending && <ListLoading rows={2} mark="none" />}
      {history.isError && <Failed error={history.error} onRetry={() => history.refetch()} />}
      {history.data && <HistoryList label="Tarix" entries={history.data} />}
    </section>
  )
}
