"use client"

import { CircleCheckIcon, MapPinIcon, SearchIcon, SlidersHorizontalIcon } from "lucide-react"
import Link from "next/link"
import { Fragment, useCallback, useEffect, useRef, useState } from "react"
import { Chip, ChoiceChips, Chips } from "@/components/kit/chips"
import { Foot, Group, SectionHeading } from "@/components/kit/group"
import { MainButton } from "@/components/kit/main-button"
import { PageTitle, PlusButton } from "@/components/kit/page-title"
import { PickerSheet } from "@/components/kit/picker-sheet"
import { SearchBox } from "@/components/kit/search-box"
import { Segmented } from "@/components/kit/segmented"
import { Pager } from "@/components/pager"
import { settingsHref } from "@/components/settings/use-settings-tab"
import { EmptyState, Failed, ListLoading } from "@/components/states"
import { shortName } from "@/lib/initials"
import { can } from "@/lib/permissions"
import { formatPhone } from "@/lib/phone"
import {
  type TaskFilter,
  useCustomerDropdowns,
  useCustomerTypes,
  useMembers,
  useTasks,
  useTaskStages,
  useTaskTypes,
} from "@/lib/queries"
import { bucketLabels, type DeadlineBucket, deadlineBucket } from "@/lib/tasks"
import type { Permission, Task } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { useKept } from "@/lib/use-kept"
import { useLocation } from "@/lib/use-location"
import { cn } from "@/lib/utils"
import { TaskBoard } from "./task-board"
import { AddTaskDialog } from "./task-dialog"
import { TaskRow } from "./task-row"
import { type TaskView, useTaskFilter } from "./use-task-filter"

const buckets: DeadlineBucket[] = ["late", "today", "week", "later", "done"]

// TasksPage is the tasks of the current location (logic/locations.md,
// section 6), for whoever may see them (tasks.view; adding takes
// tasks.create and customers.view, moving tasks.edit), as the prototype's:
// a board of the stages (the first time) or a list grouped by how far the
// deadlines are (late, today, this week, later, done), a row each with its
// stage, customer, assignee and deadline; a chip per type, the assignee and
// (in the list) the stage chosen in sheets, a search by title, customer or
// phone. The heading says the location (with two or more) and how many
// tasks it has.
export function TasksPage() {
  const gate = usePermission("tasks.view")
  const companyId = gate?.company.id ?? null
  const phone = gate?.user.phone ?? ""
  const allowed = (permission: Permission) => can(gate?.permissions, permission)
  const location = useLocation()
  const locationId = location.current?.id ?? null
  const types = useTaskTypes(companyId)
  const stages = useTaskStages(companyId)
  const dropdowns = useCustomerDropdowns(companyId)
  const customerTypes = useCustomerTypes(companyId)
  const members = useMembers(companyId)
  const [filter, update] = useTaskFilter()
  // The form for a new task, open for a stage (a column's +) or for the
  // first one (the page's +); null while closed.
  const [adding, setAdding] = useState<{ stageId: number | null } | null>(null)
  const [sheet, setSheet] = useState<null | "assignee" | "stage">(null)

  // The view is the address's; without one, the view chosen last time; the
  // first time, the board.
  const [kept, keep] = useKept(`tasks_view:${companyId ?? 0}:${phone}`)
  const view: TaskView = filter.view ?? (kept === "list" ? "list" : "board")
  const changeView = (next: TaskView) => {
    keep(next)
    update({ view: next })
  }

  const listFilter: TaskFilter = {
    locationId,
    search: filter.search,
    typeId: filter.typeId,
    stageId: filter.stageId,
    assignee: filter.assignee,
    customerId: null,
    page: filter.page,
  }
  // The list is of the current location: nothing is asked until there is one.
  const tasks = useTasks(view === "list" && locationId !== null ? companyId : null, listFilter)

  // Another location is another list: it starts from its first page. The
  // first location known is not a change.
  const shownLocation = useRef(locationId)
  useEffect(() => {
    const changed = shownLocation.current !== null && locationId !== null && shownLocation.current !== locationId
    shownLocation.current = locationId
    if (changed && filter.page > 1) update({ page: 1 })
  }, [locationId, filter.page, update])

  const stageOf = (task: Task) => stages.data?.find((stage) => stage.id === task.stage_id)
  const everyType = filter.typeId === null

  // The page needs the settings the tasks are read with, and, as a list, the
  // tasks. One that failed fails the page; trying again asks for them all.
  const queries = [types, stages, dropdowns, ...(view === "list" ? [tasks] : [])]
  const failed = queries.find((query) => query.isError)
  // How many tasks the location has is the unfiltered list's total: under a
  // filter the API counts the matches only. The total is kept from the last
  // unfiltered answer, so a filtered number never stands in for it. The
  // board has no stage filter: there every stage is a column.
  const unfiltered = everyType && !filter.assignee && !filter.search && (view === "board" || filter.stageId === null)
  const [total, setTotal] = useState<number>()
  if (unfiltered && tasks.data && !tasks.isPlaceholderData && tasks.data.total !== total) {
    setTotal(tasks.data.total)
  }
  // The board counts its columns up and tells the page, when nothing
  // narrows them.
  const onTotal = useCallback((sum: number | undefined) => {
    if (sum !== undefined) setTotal(sum)
  }, [])
  // The answer on screen while the next one loads is the previous filter's;
  // "nothing found" is not said of a filter that has not answered yet.
  const settling = tasks.isPlaceholderData && tasks.data?.total === 0
  const settingsAllowed = allowed("settings.view")
  const noStages = !failed && stages.data?.length === 0
  const noTypes = !failed && !noStages && types.data?.length === 0
  const loading = !failed && (queries.some((query) => query.isPending) || settling)
  const ready = companyId !== null && types.data && stages.data && dropdowns.data && types.data.length > 0 && stages.data.length > 0
  // A task is for a customer: adding one takes a way to the customers too,
  // and a location to enter it into.
  const canAdd = allowed("tasks.create") && allowed("customers.view") && locationId !== null
  // A member with no location to work in sees no tasks: the owner has to
  // give them one (logic/locations.md, section 5).
  const noLocation = location.ready && locationId === null
  // With two locations or more the page says which one it is.
  const where = location.locations.length >= 2 ? (location.current?.name ?? null) : null
  const count = unfiltered && total !== undefined ? `${total} ta` : null
  const description = [where, count].filter(Boolean).join(" · ") || undefined

  // The assignees are the company's members now, the signed-in one first,
  // as «Men».
  const memberName = (memberPhone: string) => {
    const member = members.data?.find((candidate) => candidate.phone === memberPhone)
    return member?.full_name ?? formatPhone(memberPhone)
  }
  const assigneeOptions = (members.data ?? [])
    .slice()
    .sort((a, b) => Number(b.phone === phone) - Number(a.phone === phone))
    .map((member) => ({ value: member.phone, label: member.phone === phone ? "Men" : (member.full_name ?? formatPhone(member.phone)) }))
  const assigneeLabel = filter.assignee === "" ? "Barcha mas'ullar" : filter.assignee === phone ? "Men" : shortName(memberName(filter.assignee))
  const stageLabel = filter.stageId === null ? "Barcha bosqichlar" : (stages.data?.find((stage) => stage.id === filter.stageId)?.name ?? "Bosqich")

  // Until the session is known to be let in there is nothing to show; a
  // stranger is on their way home.
  if (!gate) return null
  const page = tasks.data
  const setupWhat = noStages ? "bosqichlar" : "vazifa turlari"
  return (
    <>
      <PageTitle
        title="Vazifalar"
        description={description}
        action={ready && canAdd && <PlusButton label="Vazifa qo'shish" onClick={() => setAdding({ stageId: null })} />}
      />
      {noLocation ? (
        <EmptyState icon={MapPinIcon} title="Sizga lokatsiya biriktirilmagan" description="Kompaniya egasi lokatsiya biriktirishi kerak." />
      ) : noStages || noTypes ? (
        // A task stands in a stage and is of a type: with none there is
        // nothing to enter. Both are the settings' to make.
        <EmptyState
          icon={SlidersHorizontalIcon}
          title="Sozlama yetishmaydi"
          description={settingsAllowed ? `Avval ${setupWhat}ni sozlang.` : `Kompaniya egasi ${setupWhat}ni sozlashi kerak.`}
          action={
            settingsAllowed && (
              <Link href={settingsHref("tasks")} className="inline-flex h-[46px] items-center rounded-full glossy px-[22px] text-[16px] font-semibold">
                Sozlamalarni ochish
              </Link>
            )
          }
        />
      ) : (
        <>
          {types.data && stages.data && (
            <>
              <Segmented
                label="Ko'rinish"
                value={view}
                onChange={(next) => changeView(next === "list" ? "list" : "board")}
                options={[
                  { value: "board", label: "Kanban" },
                  { value: "list", label: "Ro'yxat" },
                ]}
              />
              <SearchBox value={filter.search} onSearch={(search) => update({ search })} placeholder="Nomi, mijoz yoki telefon" />
              <Chips>
                <ChoiceChips
                  bare
                  label="Vazifa turi"
                  value={filter.typeId === null ? "all" : String(filter.typeId)}
                  onChange={(value) => update({ typeId: value === "all" ? null : Number(value) })}
                  options={[{ value: "all", label: "Barchasi" }, ...types.data.map((type) => ({ value: String(type.id), label: type.name }))]}
                />
                <Chip pressed={filter.assignee !== ""} chevron onClick={() => setSheet("assignee")}>
                  {assigneeLabel}
                </Chip>
                {view === "list" && (
                  <Chip pressed={filter.stageId !== null} chevron onClick={() => setSheet("stage")}>
                    {stageLabel}
                  </Chip>
                )}
              </Chips>
              <PickerSheet
                open={sheet === "assignee"}
                onOpenChange={(open) => setSheet(open ? "assignee" : null)}
                title="Mas'ul"
                options={assigneeOptions}
                value={filter.assignee}
                onChange={(assignee) => update({ assignee })}
                none="Barcha mas'ullar"
              />
              <PickerSheet
                open={sheet === "stage"}
                onOpenChange={(open) => setSheet(open ? "stage" : null)}
                title="Bosqich"
                options={stages.data.map((stage) => ({ value: String(stage.id), label: stage.name }))}
                value={filter.stageId === null ? "" : String(filter.stageId)}
                onChange={(value) => update({ stageId: value === "" ? null : Number(value) })}
                none="Barcha bosqichlar"
              />
            </>
          )}
          {view === "board" && ready && locationId !== null && (
            <TaskBoard
              companyId={companyId}
              phone={phone}
              stages={stages.data}
              types={types.data}
              everyType={everyType}
              filter={{ locationId, search: filter.search, typeId: filter.typeId, assignee: filter.assignee }}
              onTotal={onTotal}
              onAdd={(stageId) => setAdding({ stageId })}
              canAdd={canAdd}
              canMove={allowed("tasks.edit")}
            />
          )}
          {view === "list" && loading && <ListLoading rows={6} mark="none" />}
          {failed?.error && <Failed error={failed.error} onRetry={() => queries.forEach((query) => query.refetch())} />}
          {view === "list" && !loading && !failed && page?.total === 0 && (
            <EmptyState
              icon={unfiltered ? CircleCheckIcon : SearchIcon}
              title={unfiltered ? "Hali vazifa yo'q" : "Vazifalar topilmadi"}
              description={unfiltered ? "Birinchi vazifani «Vazifa qo'shish» tugmasi orqali qo'shing." : "Qidiruv yoki filtrni o'zgartirib ko'ring."}
              action={
                unfiltered &&
                ready &&
                canAdd && (
                  <MainButton onClick={() => setAdding({ stageId: null })} className="px-5">
                    Vazifa qo&apos;shish
                  </MainButton>
                )
              }
            />
          )}
          {view === "list" && !loading && !failed && page && page.total > 0 && (
            <section aria-label="Vazifalar" className={cn(tasks.isPlaceholderData && "opacity-60")}>
              {buckets.map((bucket) => {
                const items = page.items.filter((task) => deadlineBucket(task.deadline, stageOf(task)?.is_done ?? false) === bucket)
                if (items.length === 0) return null
                return (
                  <Fragment key={bucket}>
                    <SectionHeading hint={String(items.length)}>{bucketLabels[bucket]}</SectionHeading>
                    <Group label={bucketLabels[bucket]} inset="icon">
                      {items.map((task) => (
                        <TaskRow key={task.id} task={task} stage={stageOf(task)} showStage showCustomer />
                      ))}
                    </Group>
                  </Fragment>
                )
              })}
              {page.total > page.page_size ? (
                <Pager page={page.page} pageSize={page.page_size} total={page.total} onPage={(next) => update({ page: next })} />
              ) : (
                <Foot>Jami: {page.total}</Foot>
              )}
            </section>
          )}
        </>
      )}
      {adding && ready && locationId !== null && (
        <AddTaskDialog
          companyId={companyId}
          locationId={locationId}
          types={types.data}
          stages={stages.data}
          customerTypes={customerTypes.data ?? []}
          canCreateCustomer={allowed("customers.create")}
          dropdowns={dropdowns.data}
          members={members.data ?? []}
          typeId={filter.typeId}
          stageId={adding.stageId}
          onClose={() => setAdding(null)}
        />
      )}
    </>
  )
}
