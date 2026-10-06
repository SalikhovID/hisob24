"use client"

import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Fact } from "@/components/facts"
import { Identity } from "@/components/identity"
import { PageHeader } from "@/components/page-header"
import { SelectBox } from "@/components/select-field"
import { Failed, ListLoading } from "@/components/states"
import { ApiError } from "@/lib/api"
import { customerName } from "@/lib/customers"
import { answerText } from "@/lib/fields"
import { formatDate } from "@/lib/format"
import { can } from "@/lib/permissions"
import type { Permission } from "@/lib/types"
import { formatPhone } from "@/lib/phone"
import {
  taskHistoryKey,
  useCustomer,
  useCustomerDropdowns,
  useCustomerTypes,
  useMembers,
  useMoveTask,
  useTask,
  useTaskStages,
  useTaskTypes,
} from "@/lib/queries"
import { Deadline } from "./deadline"
import { DeleteTaskButton } from "./delete-task-button"
import { EditTaskDialog } from "./edit-task-dialog"
import { usePermission } from "@/lib/use-gate"
import { StageBadge } from "./stage-badge"
import { TaskHistory } from "./task-history"

const back = { href: "/tasks", label: "Vazifalar" }

// TaskPage is one task of the company, for whoever may see the tasks
// (changing, moving, deleting and the history each take their permission):
// what it is,
// its customer, its answer to every field of its type, in the type's order,
// and who entered it and when. The stage is changed right here.
export function TaskPage({ id }: { id: number }) {
  const gate = usePermission("tasks.view")
  const companyId = gate?.company.id ?? null
  const allowed = (permission: Permission) => can(gate?.permissions, permission)
  const task = useTask(companyId, id)
  const types = useTaskTypes(companyId)
  const stages = useTaskStages(companyId)
  const dropdowns = useCustomerDropdowns(companyId)
  const members = useMembers(companyId)
  const customerTypes = useCustomerTypes(companyId)
  // The customer is asked for once the task names it: its type is told
  // beside its name.
  const customer = useCustomer(task.data ? companyId : null, task.data?.customer.id ?? 0)
  const move = useMoveTask(companyId)
  const queryClient = useQueryClient()

  // A task that is gone, or is another company's, is not found: there is
  // nothing to try again.
  if (task.error instanceof ApiError && task.error.status === 404) {
    return <PageHeader title="Vazifa topilmadi" description="Bu vazifa o'chirilgan yoki sizning kompaniyangizniki emas." back={back} />
  }
  // The page needs the task and what it is read with. One that failed fails
  // the page; trying again asks for them all.
  const queries = [task, types, stages, dropdowns]
  const failed = queries.find((query) => query.isError)
  if (!task.data || !types.data || !stages.data || !dropdowns.data || companyId === null) {
    return (
      <div className="space-y-5">
        <PageHeader title="Vazifa" back={back} />
        {failed?.error ? (
          <Failed error={failed.error} onRetry={() => queries.forEach((query) => query.refetch())} />
        ) : (
          <ListLoading rows={4} mark="none" />
        )}
      </div>
    )
  }
  const type = types.data.find((candidate) => candidate.id === task.data.type_id)
  const stage = stages.data.find((candidate) => candidate.id === task.data.stage_id)
  const done = stage?.is_done ?? false
  const customerType = customer.data ? customerTypes.data?.find((candidate) => candidate.id === customer.data.type_id) : undefined
  const name = customer.data ? customerName(customer.data, customerType) : task.data.customer.name
  const phone = formatPhone(task.data.customer.phone)

  return (
    <div className="space-y-5">
      <PageHeader
        title={task.data.title}
        description={
          <>
            {[type?.name, stage?.name].filter(Boolean).join(" · ")} · <Deadline value={task.data.deadline} done={done} />
          </>
        }
        back={back}
        stack
        actions={
          (allowed("tasks.edit") || allowed("tasks.delete")) && (
          <>
            {type && allowed("tasks.edit") && (
              <EditTaskDialog companyId={companyId} task={task.data} type={type} stages={stages.data} members={members.data ?? []} dropdowns={dropdowns.data} />
            )}
            {allowed("tasks.delete") && <DeleteTaskButton companyId={companyId} id={task.data.id} title={task.data.title} />}
            {/* The stage is changed right here, as on the board, by whoever may
                move tasks. The select stands as tall as the buttons beside it. */}
            {allowed("tasks.edit") && (
            <SelectBox
              aria-label="Bosqich"
              className="h-9! w-fit bg-card"
              value={String(task.data.stage_id)}
              disabled={move.isPending}
              onChange={(stageId) =>
                move.mutate(
                  { task: task.data, stageId: Number(stageId) },
                  {
                    onSuccess: () => {
                      toast.success("Bosqich o'zgartirildi")
                      queryClient.invalidateQueries({ queryKey: taskHistoryKey(companyId, id) })
                    },
                  },
                )
              }
              options={stages.data.map((candidate) => ({ value: String(candidate.id), label: candidate.name }))}
            />
            )}
          </>
          )
        }
      />
      <section aria-labelledby="task-customer" className="space-y-3">
        <h2 id="task-customer" className="text-base font-semibold">
          Mijoz
        </h2>
        <div className="rounded-xl border bg-card px-4 py-3">
          {/* A customer with no name goes by the phone, which is then not said twice. */}
          <Identity
            title={name ?? phone}
            subtitle={[customerType?.name, name ? phone : null].filter(Boolean).join(" · ")}
            name={name}
            seed={task.data.customer.id}
            href={`/customers/${task.data.customer.id}`}
          />
        </div>
      </section>
      <section aria-labelledby="task-info" className="space-y-3">
        <h2 id="task-info" className="text-base font-semibold">
          Ma&apos;lumot
        </h2>
        <dl className="divide-y rounded-xl border bg-card tabular-nums">
          <Fact name="Nomi" value={task.data.title} />
          <Fact name="Muddat" value={<Deadline value={task.data.deadline} done={done} />} />
          <Fact name="Bosqich" value={stage && <StageBadge stage={stage} />} />
          <Fact name="Mas'ul" value={task.data.assignee && (task.data.assignee.full_name ?? formatPhone(task.data.assignee.phone))} />
          {type?.fields.map((field) => (
            <Fact key={field.id} name={field.label} value={answerText(field, task.data.values[field.id], dropdowns.data)} />
          ))}
          <Fact name="Qo'shgan" value={task.data.created_by_name} />
          <Fact name="Qo'shilgan" value={formatDate(task.data.created_at)} />
        </dl>
      </section>
      {/* Who did what to the task takes its permission. */}
      {allowed("tasks.history") && <TaskHistory companyId={companyId} id={task.data.id} />}
    </div>
  )
}
