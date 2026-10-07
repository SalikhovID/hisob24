"use client"

import { useState } from "react"
import { type Column, DataList } from "@/components/data-list"
import { Pager } from "@/components/pager"
import { EmptyState, Failed, ListLoading } from "@/components/states"
import { Deadline } from "@/components/tasks/deadline"
import { StageBadge } from "@/components/tasks/stage-badge"
import { Badge } from "@/components/ui/badge"
import { useTasks, useTaskStages } from "@/lib/queries"
import type { Task } from "@/lib/types"
import { useLocation } from "@/lib/use-location"

// CustomerTasks is the tasks a customer has, on its page: each by its
// title (the way into the task), its stage, its location (with two or more
// to work in: the customer's tasks are of every one of them, whatever the
// current one) and its deadline, the one due soonest first, twenty at a
// time.
export function CustomerTasks({ companyId, customerId }: { companyId: number; customerId: number }) {
  const [page, setPage] = useState(1)
  const tasks = useTasks(companyId, { locationId: null, search: "", typeId: null, stageId: null, assignee: "", customerId, page })
  const stages = useTaskStages(companyId)
  const { locations } = useLocation()
  const stageOf = (task: Task) => stages.data?.find((stage) => stage.id === task.stage_id)
  const columns: Column<Task>[] = [
    { header: "Vazifa", primary: true, cell: (task) => task.title },
    {
      header: "Bosqich",
      card: "tag",
      cell: (task) => {
        const stage = stageOf(task)
        return stage && <StageBadge stage={stage} />
      },
    },
    ...(locations.length >= 2
      ? [
          {
            header: "Lokatsiya",
            card: "tag",
            cell: (task) => {
              const location = locations.find((l) => l.id === task.location_id)
              return location && <Badge variant="outline">{location.name}</Badge>
            },
          } satisfies Column<Task>,
        ]
      : []),
    { header: "Muddat", card: "inline", cell: (task) => <Deadline value={task.deadline} done={stageOf(task)?.is_done ?? false} /> },
  ]
  const queries = [tasks, stages]
  const failed = queries.find((query) => query.isError)
  return (
    <section aria-labelledby="customer-tasks" className="space-y-3">
      <h2 id="customer-tasks" className="text-base font-semibold">
        Vazifalar
      </h2>
      {!failed && queries.some((query) => query.isPending) && <ListLoading rows={2} mark="none" />}
      {failed?.error && <Failed error={failed.error} onRetry={() => queries.forEach((query) => query.refetch())} />}
      {!failed && tasks.data?.total === 0 && <EmptyState title="Bu mijozda vazifa yo'q" />}
      {!failed && tasks.data && stages.data && tasks.data.total > 0 && (
        <DataList
          label="Vazifalar"
          items={tasks.data.items}
          columns={columns}
          getKey={(task) => task.id}
          href={(task) => `/tasks/${task.id}`}
          footer={<Pager page={tasks.data.page} pageSize={tasks.data.page_size} total={tasks.data.total} onPage={setPage} />}
        />
      )}
    </section>
  )
}
