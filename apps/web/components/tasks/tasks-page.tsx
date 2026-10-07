"use client"

import { Radio } from "@base-ui/react/radio"
import { RadioGroup } from "@base-ui/react/radio-group"
import { KanbanIcon, ListIcon, PlusIcon } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { ColumnsMenu } from "@/components/customers/columns-menu"
import { SearchInput } from "@/components/customers/search-input"
import { type Column, DataList } from "@/components/data-list"
import { PageHeader } from "@/components/page-header"
import { Pager } from "@/components/pager"
import { SelectBox } from "@/components/select-field"
import { settingsHref } from "@/components/settings/use-settings-tab"
import { EmptyState, Failed, ListLoading } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { answerText, fieldColumns } from "@/lib/fields"
import { formatDate } from "@/lib/format"
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
import type { Permission, Task } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { useHiddenColumns } from "@/lib/use-hidden-columns"
import { useKept } from "@/lib/use-kept"
import { useLocation } from "@/lib/use-location"
import { cn } from "@/lib/utils"
import { Deadline } from "./deadline"
import { StageBadge } from "./stage-badge"
import { TaskBoard } from "./task-board"
import { AddTaskDialog } from "./task-dialog"
import { type TaskView, useTaskFilter } from "./use-task-filter"

// A tab is quiet until it is the chosen one, which then stands out as a card
// on the muted strip. Never the brand color: that is the page's one button.
const tab = "px-3 text-muted-foreground data-active:bg-card"

// The view buttons are a pair of radios in the tabs' style.
const viewRadio =
  "inline-flex h-8 cursor-default items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:bg-card data-checked:text-foreground data-checked:shadow-sm [&_svg]:size-4"

// Nothing says a filtered list: what a member keeps by hand (a type, a
// stage, an assignee, a search) narrows the tasks and the count. A select
// of the toolbar stands as tall as the search beside it.
const toolbarSelect = "h-9! w-fit bg-card"

// TasksPage is the tasks of the current location (logic/locations.md,
// section 6), for whoever may see them (tasks.view; adding takes
// tasks.create and customers.view, moving tasks.edit): as a board of the
// stages (the first time) or as a list, the one due soonest first, each
// with its customer, stage, deadline, assignee and answers. Fields of one
// name share a column, whatever the type.
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
  // first one (the page's button); null while closed.
  const [adding, setAdding] = useState<{ stageId: number | null } | null>(null)

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

  const typeOf = (task: Task) => types.data?.find((type) => type.id === task.type_id)
  const stageOf = (task: Task) => stages.data?.find((stage) => stage.id === task.stage_id)
  // Under a tab the list is of one type: its fields are the columns, and the
  // type is not said in every row.
  const everyType = filter.typeId === null
  const shownTypes = (types.data ?? []).filter((type) => everyType || type.id === filter.typeId)

  // Every column has a key: the menu and the user's choice go by it.
  const columns: (Column<Task> & { key: string })[] = [
    { key: "task", header: "Vazifa", primary: true, cell: (task) => task.title },
    {
      key: "customer",
      header: "Mijoz",
      // A customer with no name goes by the phone, which then is not said
      // twice. In the table the customer links to its page; on a card it is
      // only named, as on the board's cards: the card's whole face is the
      // task's link, and a second link under a thumb would open the customer
      // instead (the task's page links the customer).
      cell: (task, place) => {
        const name = task.customer.name ?? formatPhone(task.customer.phone)
        return (
          <span className="flex min-w-0 flex-col">
            {place === "card" ? (
              <span className="min-w-0 [overflow-wrap:anywhere]">{name}</span>
            ) : (
              <Link
                href={`/customers/${task.customer.id}`}
                className="min-w-0 font-medium underline-offset-4 [overflow-wrap:anywhere] hover:underline"
              >
                {name}
              </Link>
            )}
            {task.customer.name && (
              <span className="text-[0.8125rem] leading-5 whitespace-nowrap text-muted-foreground">{formatPhone(task.customer.phone)}</span>
            )}
          </span>
        )
      },
    },
    ...(everyType
      ? [
          {
            key: "type",
            header: "Turi",
            card: "tag",
            cell: (task) => {
              const type = typeOf(task)
              return type && <Badge variant="secondary">{type.name}</Badge>
            },
          } satisfies Column<Task>,
        ]
      : []),
    {
      key: "stage",
      header: "Bosqich",
      card: "tag",
      cell: (task) => {
        const stage = stageOf(task)
        return stage && <StageBadge stage={stage} />
      },
    },
    {
      key: "deadline",
      header: "Muddat",
      card: "inline",
      cell: (task) => <Deadline value={task.deadline} done={stageOf(task)?.is_done ?? false} />,
    },
    {
      key: "assignee",
      header: "Mas'ul",
      cell: (task) => task.assignee && (task.assignee.full_name ?? formatPhone(task.assignee.phone)),
    },
    ...fieldColumns(shownTypes).map(
      (column): Column<Task> & { key: string } => ({
        key: column.key,
        header: column.label,
        // A long answer wraps inside its cell; a word is broken only when it
        // alone is wider than the cell may be (see the customers).
        className: "max-w-64 whitespace-normal break-words",
        cell: (task) => {
          const field = column.fields[task.type_id]
          return field && answerText(field, task.values[field.id], dropdowns.data ?? [])
        },
      }),
    ),
    { key: "created_by", header: "Qo'shgan", className: "text-muted-foreground", cell: (task) => task.created_by_name },
    {
      key: "created_at",
      header: "Qo'shilgan",
      card: "inline",
      className: "text-muted-foreground",
      cell: (task) => formatDate(task.created_at),
    },
  ]

  // The task itself always shows; any other column the user may hide.
  const { hidden, toggle } = useHiddenColumns(companyId ?? 0, phone, "tasks")
  const optional = columns.filter((column) => !column.primary)
  const shown = columns.filter((column) => column.primary || !hidden.has(column.key))

  // The page needs the settings the tasks are read with, and, as a list, the
  // tasks. One that failed fails the page; trying again asks for them all.
  const queries = [types, stages, dropdowns, ...(view === "list" ? [tasks] : [])]
  const failed = queries.find((query) => query.isError)
  // How many tasks the company has is the unfiltered list's total: under a
  // filter the API counts the matches only. The total is kept from the last
  // unfiltered answer, so a filtered number never stands in for it.
  // The board has no stage filter: there every stage is a column.
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

  // Until the session is known to be let in there is nothing to show; a
  // stranger is on their way home.
  if (!gate) return null
  return (
    <div className="space-y-5">
      <PageHeader
        title="Vazifalar"
        description={unfiltered && total !== undefined ? `Kompaniyangiz vazifalari · ${total} ta` : "Kompaniyangiz vazifalari"}
        actions={
          ready &&
          canAdd && (
            <Button size="lg" className="px-3.5" onClick={() => setAdding({ stageId: null })}>
              <PlusIcon />
              Vazifa qo&apos;shish
            </Button>
          )
        }
      />
      {noLocation ? (
        <div className="rounded-xl border bg-card px-4 py-10 text-center text-sm">
          <p className="font-medium">Sizga lokatsiya biriktirilmagan</p>
          <p className="mt-1 text-pretty text-muted-foreground">Kompaniya egasi lokatsiya biriktirishi kerak.</p>
        </div>
      ) : noStages || noTypes ? (
        // A task stands in a stage and is of a type: with none there is
        // nothing to enter. Both are the settings' to make.
        <div className="rounded-xl border bg-card px-4 py-10 text-center text-sm">
          <p className="font-medium">{noStages ? "Bosqichlar yo'q" : "Vazifa turlari yo'q"}</p>
          <p className="mt-1 text-pretty text-muted-foreground">
            {noStages
              ? settingsAllowed
                ? "Vazifa qo'shish uchun avval Sozlamalarda bosqich yarating."
                : "Kompaniya egasi bosqichlarni sozlashi kerak."
              : settingsAllowed
                ? "Vazifa qo'shish uchun avval Sozlamalarda tur yarating."
                : "Kompaniya egasi vazifa turlarini sozlashi kerak."}
          </p>
          {settingsAllowed && (
            <Link href={settingsHref("tasks")} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "mt-4")}>
              Sozlamalarni ochish
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {types.data && stages.data && (
            // The toolbar is wide: the tabs take a row of their own until there
            // is room for everything beside them.
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              {/* Types are the owner's to make: the strip of them scrolls
                  sideways rather than squeezing. */}
              <div className="-mx-1 min-w-0 overflow-x-auto px-1 py-0.5 scrollbar-hide">
                <Tabs
                  value={filter.typeId === null ? "all" : String(filter.typeId)}
                  onValueChange={(value) => update({ typeId: value === "all" ? null : Number(value) })}
                >
                  <TabsList className="group-data-horizontal/tabs:h-9 max-sm:min-w-full">
                    <TabsTrigger value="all" className={tab}>
                      Barchasi
                    </TabsTrigger>
                    {types.data.map((type) => (
                      <TabsTrigger key={type.id} value={String(type.id)} className={tab}>
                        {type.name}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <SearchInput value={filter.search} onSearch={(search) => update({ search })} placeholder="Nomi, mijoz yoki telefon" />
                {view === "list" && (
                  <SelectBox
                    aria-label="Bosqich"
                    className={toolbarSelect}
                    value={filter.stageId === null ? "" : String(filter.stageId)}
                    onChange={(value) => update({ stageId: value === "" ? null : Number(value) })}
                    empty="Barcha bosqichlar"
                    options={stages.data.map((stage) => ({ value: String(stage.id), label: stage.name }))}
                  />
                )}
                <SelectBox
                  aria-label="Mas'ul"
                  className={toolbarSelect}
                  value={filter.assignee}
                  onChange={(assignee) => update({ assignee })}
                  empty="Barcha mas'ullar"
                  // The company's members now; the signed-in one as "Men".
                  options={(members.data ?? []).map((member) => ({
                    value: member.phone,
                    label: member.phone === phone ? "Men" : (member.full_name ?? formatPhone(member.phone)),
                  }))}
                />
                <RadioGroup
                  aria-label="Ko'rinish"
                  value={view}
                  onValueChange={(value) => changeView(value === "list" ? "list" : "board")}
                  className="flex h-9 shrink-0 items-center gap-0.5 rounded-lg bg-muted p-[3px]"
                >
                  <Radio.Root value="list" className={viewRadio}>
                    <ListIcon aria-hidden="true" />
                    Ro&apos;yxat
                  </Radio.Root>
                  <Radio.Root value="board" className={viewRadio}>
                    <KanbanIcon aria-hidden="true" />
                    Kanban
                  </Radio.Root>
                </RadioGroup>
                {view === "list" && (
                  <ColumnsMenu
                    columns={optional.map((column) => ({ key: column.key, label: column.header }))}
                    hidden={hidden}
                    onToggle={toggle}
                  />
                )}
              </div>
            </div>
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
          {view === "list" && loading && <ListLoading rows={6} mark="none" />}
          {failed?.error && <Failed error={failed.error} onRetry={() => queries.forEach((query) => query.refetch())} />}
          {view === "list" && !loading && !failed && tasks.data?.total === 0 && (
            <EmptyState
              title={unfiltered ? "Hali vazifa yo'q" : "Vazifalar topilmadi"}
              description={
                unfiltered ? "Birinchi vazifani «Vazifa qo'shish» tugmasi orqali qo'shing." : "Qidiruv yoki filtrni o'zgartirib ko'ring."
              }
            />
          )}
          {view === "list" && !loading && !failed && tasks.data && tasks.data.total > 0 && (
            <DataList
              label="Vazifalar"
              items={tasks.data.items}
              columns={shown}
              getKey={(task) => task.id}
              href={(task) => `/tasks/${task.id}`}
              footer={
                <Pager page={tasks.data.page} pageSize={tasks.data.page_size} total={tasks.data.total} onPage={(page) => update({ page })} />
              }
            />
          )}
        </div>
      )}
    </div>
  )
}
