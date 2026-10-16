"use client"

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { PlusIcon, XIcon } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Foot } from "@/components/kit/group"
import { Failed, Loading } from "@/components/states"
import { Button } from "@/components/ui/button"
import { type StageFilter, useMoveTask, useStageTasks } from "@/lib/queries"
import { colorValues } from "@/lib/stage-colors"
import type { Task, TaskStage, TaskType } from "@/lib/types"
import { useKept } from "@/lib/use-kept"
import { cn } from "@/lib/utils"
import { CardContent, ghostClass, TaskCard } from "./task-card"

// ids reads the stages a user opened, as kept. What the browser hands back
// is not trusted: anything but a list of ids is no choice at all.
function ids(kept: string | null): string[] {
  try {
    const value: unknown = JSON.parse(kept ?? "[]")
    return Array.isArray(value) && value.every((id) => typeof id === "string") ? value : []
  } catch {
    return []
  }
}

const instructions = "Kartani sudrab boshqa bosqichga tashlang, yoki kartadagi Bosqich menyusidan tanlang."

// howToMove is said under the board to whoever may move the cards.
const howToMove = "Kartani bosib turing va boshqa ustunga suring yoki ⋯ orqali bosqichni almashtiring."

// TaskBoard is the location's tasks as the prototype's board: a column per
// stage, in the stages' order (most of a phone's width each, snapping into
// place), each with its tasks due soonest first, twenty at a time.
// A card is dragged to another column, or moved from its menu; every move
// is said aloud. A done stage's column stands folded until it is opened,
// and stays as it was left. The columns count their tasks up for the page.
export function TaskBoard({
  companyId,
  phone,
  stages,
  types,
  everyType,
  filter,
  onTotal,
  onAdd,
  canAdd,
  canMove,
}: {
  companyId: number
  phone: string
  stages: TaskStage[]
  types: TaskType[]
  // everyType says whether the board is under every type: then each card
  // says its type.
  everyType: boolean
  filter: StageFilter
  // onTotal gets how many tasks the company has, from the columns, when
  // nothing narrows them.
  onTotal: (total: number | undefined) => void
  // onAdd opens the form for a task in the stage.
  onAdd: (stageId: number) => void
  // canAdd and canMove are what the member may do: add a task (the + of a
  // column), move one (a drag, the stage menu).
  canAdd: boolean
  canMove: boolean
}) {
  const move = useMoveTask(companyId)
  const [dragging, setDragging] = useState<Task | null>(null)
  const [announcement, setAnnouncement] = useState("")
  // A press that moves a little is a drag; a finger that rests first is a
  // drag too, so the column still scrolls under a passing thumb.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 330, tolerance: 6 } }),
  )

  // The done columns the user opened, kept in the browser.
  const [kept, keep] = useKept(`tasks_board_open:${companyId}:${phone}`)
  const opened = useMemo(() => new Set(ids(kept)), [kept])
  const toggle = (stage: TaskStage) => {
    const id = String(stage.id)
    keep(JSON.stringify(opened.has(id) ? [...opened].filter((other) => other !== id) : [...opened, id]))
  }

  // The columns count their tasks; the sum is the company's when nothing
  // narrows the columns.
  const [totals, setTotals] = useState<Record<number, number>>({})
  const onLoaded = useCallback((stageId: number, total: number) => {
    setTotals((known) => (known[stageId] === total ? known : { ...known, [stageId]: total }))
  }, [])
  const unfiltered = everyType && !filter.search && !filter.assignee
  const sum = stages.every((stage) => totals[stage.id] !== undefined) ? stages.reduce((n, stage) => n + totals[stage.id], 0) : undefined
  useEffect(() => {
    if (unfiltered) onTotal(sum)
  }, [unfiltered, sum, onTotal])

  const moveTo = (task: Task, stage: TaskStage) => {
    if (task.stage_id === stage.id) return
    move.mutate({ task, stageId: stage.id }, { onSuccess: () => setAnnouncement(`«${task.title}» «${stage.name}» bosqichiga ko'chirildi`) })
  }
  const onDragStart = ({ active }: DragStartEvent) => setDragging((active.data.current?.task as Task | undefined) ?? null)
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null)
    const task = active.data.current?.task as Task | undefined
    const stage = stages.find((candidate) => candidate.id === Number(over?.id))
    if (task && stage) moveTo(task, stage)
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
      // The board says its own moves, once, in its own words.
      accessibility={{
        announcements: { onDragStart: () => "", onDragOver: () => "", onDragEnd: () => "", onDragCancel: () => "" },
        screenReaderInstructions: { draggable: instructions },
      }}
    >
      {/* The columns scroll sideways, out to the page's edges. */}
      <section aria-label="Kanban" className="-mx-4 snap-x snap-mandatory scroll-px-4 overflow-x-auto px-4 pt-0.5 pb-2 scrollbar-hide md:-mx-6 md:scroll-px-6 md:px-6">
        <div className="flex items-start gap-2.5">
          {stages.map((stage) => (
            <StageColumn
              key={stage.id}
              companyId={companyId}
              stage={stage}
              stages={stages}
              types={types}
              everyType={everyType}
              filter={filter}
              folded={stage.is_done && !opened.has(String(stage.id))}
              onToggle={() => toggle(stage)}
              onAdd={canAdd ? () => onAdd(stage.id) : undefined}
              onMove={canMove ? moveTo : undefined}
              onLoaded={onLoaded}
            />
          ))}
        </div>
      </section>
      {canMove && <Foot className="mt-1.5">{howToMove}</Foot>}
      <DragOverlay dropAnimation={null}>
        {dragging && (
          <div className={cn(ghostClass, "w-72 rotate-2 cursor-grabbing px-3.5 py-3")}>
            <CardContent
              task={dragging}
              stage={stages.find((stage) => stage.id === dragging.stage_id) ?? stages[0]}
              type={everyType ? types.find((type) => type.id === dragging.type_id) : undefined}
            />
          </div>
        )}
      </DragOverlay>
      {/* Named apart from dnd-kit's own live region, which says nothing. */}
      <div role="status" aria-label="Ko'chirishlar" aria-live="polite" aria-atomic className="sr-only">
        {announcement}
      </div>
    </DndContext>
  )
}

// StageColumn is one stage's column: its name and count, a way to add a
// task into it, its cards and, under them, how many there are in all and a
// way to the next twenty. A card dropped on it lands in the stage.
function StageColumn({
  companyId,
  stage,
  stages,
  types,
  everyType,
  filter,
  folded,
  onToggle,
  onAdd,
  onMove,
  onLoaded,
}: {
  companyId: number
  stage: TaskStage
  stages: TaskStage[]
  types: TaskType[]
  everyType: boolean
  filter: StageFilter
  folded: boolean
  onToggle: () => void
  // onAdd and onMove are undefined where the member may not add or move.
  onAdd?: () => void
  onMove?: (task: Task, stage: TaskStage) => void
  onLoaded: (stageId: number, total: number) => void
}) {
  const tasks = useStageTasks(companyId, stage.id, filter)
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })
  const items = tasks.data?.pages.flatMap((page) => page.items) ?? []
  const total = tasks.data?.pages[0]?.total
  const settled = total !== undefined && !tasks.isPlaceholderData
  useEffect(() => {
    if (settled) onLoaded(stage.id, total)
  }, [settled, stage.id, total, onLoaded])

  const count = total ?? "…"
  const dot = <span aria-hidden="true" style={{ background: colorValues[stage.color] }} className="size-2.5 shrink-0 rounded-full" />
  return (
    <section
      aria-label={stage.name}
      ref={setNodeRef}
      data-slot="stage-column"
      className={cn(
        "flex shrink-0 snap-start flex-col rounded-[28px] bg-(--col) p-1.5 shadow-(--rim) transition-[background-color,box-shadow] duration-150",
        folded ? "w-[58px]" : "w-[84%] md:w-72",
        isOver && "bg-primary-soft ring-2 ring-primary ring-inset",
      )}
    >
      {folded ? (
        // Folded: the name and the count stand on end, on the button that opens it.
        <button
          type="button"
          aria-expanded={false}
          onClick={onToggle}
          className="flex min-h-60 w-full flex-col items-center gap-2.5 rounded-[20px] py-3.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {dot}
          <span className="flex items-center gap-2 text-[15px] font-semibold [writing-mode:vertical-rl]">
            {stage.name}{" "}
            <span className="font-medium text-muted-foreground">({count})</span>
          </span>
        </button>
      ) : (
        <>
          <header className="flex min-h-11 items-center gap-2 py-1.5 pr-1.5 pl-2.5 text-base font-semibold">
            {dot}
            <h2 className="min-w-0 truncate">{stage.name}</h2>
            <span data-slot="column-count" className="font-medium text-muted-foreground tabular-nums">
              {count}
            </span>
            <span className="ml-auto flex items-center">
              {stage.is_done && (
                <button
                  type="button"
                  aria-expanded
                  aria-label={`${stage.name} (${count})`}
                  onClick={onToggle}
                  className="grid size-9 place-items-center rounded-full text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <XIcon aria-hidden="true" strokeWidth={2.4} className="size-[18px]" />
                </button>
              )}
              {onAdd && (
                <button
                  type="button"
                  aria-label={`Vazifa qo'shish: ${stage.name}`}
                  onClick={onAdd}
                  className="grid size-9 place-items-center rounded-full text-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <PlusIcon aria-hidden="true" strokeWidth={2.6} className="size-5" />
                </button>
              )}
            </span>
          </header>
          {tasks.isPending && <Loading rows={2} />}
          {tasks.isError && <Failed error={tasks.error} onRetry={() => tasks.refetch()} />}
          {tasks.data &&
            (items.length === 0 ? (
              <p className="rounded-2xl border-[1.5px] border-dashed border-border px-2 py-[18px] text-center text-md text-muted-foreground">
                {onMove ? "Kartani shu yerga suring" : "Bo'sh"}
              </p>
            ) : (
              <ul aria-label={`${stage.name}: vazifalar`} className="flex min-h-[60px] flex-col gap-1.5">
                {items.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    stage={stage}
                    stages={stages}
                    type={everyType ? types.find((type) => type.id === task.type_id) : undefined}
                    onMove={onMove}
                  />
                ))}
              </ul>
            ))}
          <footer className="flex min-h-10 items-center justify-between gap-2 px-2.5 pt-2 pb-1 text-xs text-muted-foreground">
            <span>Jami: {total ?? 0}</span>
            {tasks.hasNextPage && (
              <Button variant="outline" size="sm" onClick={() => tasks.fetchNextPage()} disabled={tasks.isFetchingNextPage}>
                Yana
              </Button>
            )}
          </footer>
        </>
      )}
    </section>
  )
}
