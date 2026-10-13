"use client"

import { useState } from "react"
import { Foot, Group, SectionHeading } from "@/components/kit/group"
import { Pager } from "@/components/pager"
import { EmptyState, Failed, ListLoading } from "@/components/states"
import { TaskRow } from "@/components/tasks/task-row"
import { useTasks, useTaskStages } from "@/lib/queries"
import { useLocation } from "@/lib/use-location"

// CustomerTasks is the tasks a customer has, on its page, as the
// prototype's rows: each its title (the way into the task), its stage, its
// location (with two or more to work in: the customer's tasks are of every
// one of them, whatever the current one), its assignee and its deadline,
// the one due soonest first, twenty at a time.
export function CustomerTasks({ companyId, customerId }: { companyId: number; customerId: number }) {
  const [page, setPage] = useState(1)
  const tasks = useTasks(companyId, { locationId: null, search: "", typeId: null, stageId: null, assignee: "", customerId, page })
  const stages = useTaskStages(companyId)
  const { locations } = useLocation()
  const queries = [tasks, stages]
  const failed = queries.find((query) => query.isError)
  const data = tasks.data
  return (
    <section aria-label="Vazifalar">
      <SectionHeading>Vazifalar</SectionHeading>
      {!failed && queries.some((query) => query.isPending) && <ListLoading rows={2} mark="none" />}
      {failed?.error && <Failed error={failed.error} onRetry={() => queries.forEach((query) => query.refetch())} />}
      {!failed && data?.total === 0 && <EmptyState title="Bu mijozda vazifa yo'q" />}
      {!failed && data && stages.data && data.total > 0 && (
        <>
          <Group label="Vazifalar" inset="icon">
            {data.items.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                stage={stages.data.find((stage) => stage.id === task.stage_id)}
                showStage
                locationName={locations.length >= 2 ? (locations.find((l) => l.id === task.location_id)?.name ?? null) : null}
              />
            ))}
          </Group>
          {data.total > data.page_size ? (
            <Pager page={data.page} pageSize={data.page_size} total={data.total} onPage={setPage} />
          ) : (
            <Foot>Jami: {data.total}</Foot>
          )}
        </>
      )}
    </section>
  )
}
