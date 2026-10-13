"use client"

import { useQueryClient } from "@tanstack/react-query"
import { ClipboardListIcon, PencilIcon, PhoneIcon, UserIcon } from "lucide-react"
import { type CSSProperties, useState } from "react"
import { toast } from "sonner"
import { Avatar } from "@/components/kit/avatar"
import { DetailHead, Tile, Tiles } from "@/components/kit/detail-head"
import { Group, KeyValue, Row, SectionHeading } from "@/components/kit/group"
import { BackLink, PageTitle } from "@/components/kit/page-title"
import { Failed, ListLoading, NotFound } from "@/components/states"
import { ApiError } from "@/lib/api"
import { customerName } from "@/lib/customers"
import { answerText } from "@/lib/fields"
import { formatDate } from "@/lib/format"
import { can } from "@/lib/permissions"
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
import { colorValues } from "@/lib/stage-colors"
import type { Permission } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { useLocation } from "@/lib/use-location"
import { DeadlineCard } from "./deadline-card"
import { DeleteTaskButton } from "./delete-task-button"
import { EditTaskDialog } from "./edit-task-dialog"
import { StageBadge } from "./stage-badge"
import { StageTrack } from "./stage-track"
import { TaskHistory } from "./task-history"

const back = { href: "/tasks", label: "Vazifalar" }

// TaskPage is one task of the company, for whoever may see the tasks
// (changing, moving, deleting and the history each take their permission),
// as the prototype's page: what it is (its stage's tile, its title, its type
// and customer), its stage on a track of all of them (moved right here), its
// deadline, the tiles (editing, the customer, a call to the customer), the
// customer's row, its answer to every field of its type in the type's order
// with who entered it and when, its history, and at the foot the way to
// delete it.
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
  // With two or more locations to work in the page says the task's one.
  const { locations } = useLocation()
  const [editing, setEditing] = useState(false)

  // A task that is gone, or is another company's, is not found: there is
  // nothing to try again.
  if (task.error instanceof ApiError && task.error.status === 404) {
    return (
      <>
        <BackLink {...back} />
        <NotFound title="Vazifa topilmadi" description="Bu vazifa o'chirilgan yoki sizning kompaniyangizniki emas." />
      </>
    )
  }
  // The page needs the task and what it is read with. One that failed fails
  // the page; trying again asks for them all.
  const queries = [task, types, stages, dropdowns]
  const failed = queries.find((query) => query.isError)
  if (!task.data || !types.data || !stages.data || !dropdowns.data || companyId === null) {
    return (
      <>
        <PageTitle title="Vazifa" back={back} />
        {failed?.error ? (
          <Failed error={failed.error} onRetry={() => queries.forEach((query) => query.refetch())} />
        ) : (
          <ListLoading rows={4} mark="none" />
        )}
      </>
    )
  }
  const type = types.data.find((candidate) => candidate.id === task.data.type_id)
  const stage = stages.data.find((candidate) => candidate.id === task.data.stage_id)
  const done = stage?.is_done ?? false
  const customerType = customer.data ? customerTypes.data?.find((candidate) => candidate.id === customer.data.type_id) : undefined
  const name = customer.data ? customerName(customer.data, customerType) : task.data.customer.name
  const phone = formatPhone(task.data.customer.phone)
  const customerHref = allowed("customers.view") ? `/customers/${task.data.customer.id}` : undefined

  return (
    <>
      <BackLink {...back} />
      <DetailHead
        media={
          <span
            aria-hidden="true"
            style={{ "--c": stage ? colorValues[stage.color] : "var(--muted-foreground)" } as CSSProperties}
            className="grid size-[76px] place-items-center rounded-[24px] bg-[color-mix(in_srgb,var(--c)_16%,transparent)] text-[color-mix(in_srgb,var(--c)_62%,var(--foreground))]"
          >
            <ClipboardListIcon strokeWidth={1.9} className="size-9" />
          </span>
        }
        title={task.data.title}
        description={[type?.name, name ?? phone].filter(Boolean).join(" · ")}
      />
      <StageTrack
        stages={stages.data}
        value={task.data.stage_id}
        // The stage is changed right here, as on the board, by whoever may move tasks.
        disabled={!allowed("tasks.edit") || move.isPending}
        onChange={(stageId) =>
          move.mutate(
            { task: task.data, stageId },
            {
              onSuccess: () => {
                toast.success("Bosqich o'zgartirildi")
                queryClient.invalidateQueries({ queryKey: taskHistoryKey(companyId, id) })
              },
            },
          )
        }
      />
      <DeadlineCard deadline={task.data.deadline} done={done} />
      <Tiles>
        {type && allowed("tasks.edit") && <Tile icon={PencilIcon} label="Tahrirlash" onClick={() => setEditing(true)} />}
        {customerHref && <Tile icon={UserIcon} label="Mijoz" href={customerHref} />}
        <Tile icon={PhoneIcon} label="Qo'ng'iroq" href={`tel:+${task.data.customer.phone}`} />
      </Tiles>
      <section aria-label="Mijoz">
        <SectionHeading>Mijoz</SectionHeading>
        <Group label="Mijoz" inset="icon">
          {/* A customer with no name goes by the phone, which is then not said twice. */}
          <Row
            href={customerHref}
            media={<Avatar name={name} seed={task.data.customer.id} />}
            title={name ?? phone}
            sub={[customerType?.name, name ? phone : null].filter(Boolean).join(" · ") || undefined}
          />
        </Group>
      </section>
      <section aria-label="Ma'lumot">
        <SectionHeading>Ma&apos;lumot</SectionHeading>
        <Group as="dl">
          <KeyValue label="Turi" value={type?.name} />
          <KeyValue label="Bosqich" value={stage && <StageBadge stage={stage} />} />
          {locations.length >= 2 && <KeyValue label="Lokatsiya" value={locations.find((l) => l.id === task.data.location_id)?.name} />}
          <KeyValue label="Mas'ul" value={task.data.assignee && (task.data.assignee.full_name ?? formatPhone(task.data.assignee.phone))} />
          {type?.fields.map((field) => (
            <KeyValue key={field.id} label={field.label} value={answerText(field, task.data.values[field.id], dropdowns.data)} />
          ))}
          <KeyValue label="Qo'shgan" value={task.data.created_by_name} />
          <KeyValue label="Qo'shilgan" value={formatDate(task.data.created_at)} />
        </Group>
      </section>
      {/* Who did what to the task takes its permission. */}
      {allowed("tasks.history") && <TaskHistory companyId={companyId} id={task.data.id} />}
      {allowed("tasks.delete") && <DeleteTaskButton companyId={companyId} id={task.data.id} title={task.data.title} />}
      {editing && type && (
        <EditTaskDialog
          companyId={companyId}
          task={task.data}
          type={type}
          stages={stages.data}
          members={members.data ?? []}
          dropdowns={dropdowns.data}
          open
          onOpenChange={(open) => !open && setEditing(false)}
        />
      )}
    </>
  )
}
