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
import { ChevronsLeftIcon, PlusIcon } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ActionTooltip } from "@/components/action-tooltip"
import { Failed, Loading } from "@/components/states"
import { Button } from "@/components/ui/button"
import { type StageFilter, useMoveTask, useStageTasks } from "@/lib/queries"
import { colorClasses } from "@/lib/stage-colors"
import type { Task, TaskStage, TaskType } from "@/lib/types"
import { useKept } from "@/lib/use-kept"
import { cn } from "@/lib/utils"
import { CardContent, cardClass, TaskCard } from "./task-card"

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

// TaskBoard is the company's tasks as a board: a column per stage, in the
// stages' order, each with its tasks due soonest first, twenty at a time.
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
}) {
  const move = useMoveTask(companyId)
  const [dragging, setDragging] = useState<Task | null>(null)
  const [announcement, setAnnouncement] = useState("")
  // A press that moves a little is a drag; a finger that rests first is a
  // drag too, so the column still scrolls under a passing thumb.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
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
      <section aria-label="Kanban" className="-mx-4 overflow-x-auto px-4 pb-2 md:-mx-6 md:px-6">
        <div className="flex snap-x items-start gap-3">
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
              onAdd={() => onAdd(stage.id)}
              onMove={moveTo}
              onLoaded={onLoaded}
            />
          ))}
        </div>
      </section>
      <DragOverlay dropAnimation={null}>
        {dragging && (
          <div className={cn(cardClass, "w-72 cursor-grabbing shadow-lg")}>
            <CardContent
              task={dragging}
              stage={stages.find((stage) => stage.id === dragging.stage_id) ?? stages[0]}
              stages={stages}
              type={everyType ? types.find((type) => type.id === dragging.type_id) : undefined}
              onMove={moveTo}
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
  onAdd: () => void
  onMove: (task: Task, stage: TaskStage) => void
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
  const dot = <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-full", colorClasses[stage.color].dot)} />
  return (
    <section
      aria-label={stage.name}
      ref={setNodeRef}
      data-slot="stage-column"
      className={cn(
        "flex shrink-0 snap-start flex-col rounded-xl bg-muted/50 ring-ring/50 transition-shadow",
        folded ? "w-12" : "w-72 max-md:w-[85vw]",
        isOver && "ring-2",
      )}
    >
      {folded ? (
        // Folded: the name and the count stand on end, on the button that opens it.
        <button
          type="button"
          aria-expanded={false}
          onClick={onToggle}
          className="flex min-h-48 w-12 flex-col items-center gap-2 rounded-xl py-3 text-sm font-medium text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {dot}
          <span className="[writing-mode:vertical-rl]">
            {stage.name} ({count})
          </span>
        </button>
      ) : (
        <>
          <header className="flex items-center gap-2 px-3 py-2">
            {dot}
            <h2 className="min-w-0 truncate text-sm font-semibold">{stage.name}</h2>
            <span data-slot="column-count" className="rounded-full bg-background px-1.5 text-xs text-muted-foreground tabular-nums">
              {count}
            </span>
            <span className="ml-auto flex items-center">
              {stage.is_done && (
                <ActionTooltip label="Yig'ish">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-expanded
                    aria-label={`${stage.name} (${count})`}
                    onClick={onToggle}
                    className="text-muted-foreground"
                  >
                    <ChevronsLeftIcon />
                  </Button>
                </ActionTooltip>
              )}
              <ActionTooltip label="Vazifa qo'shish">
                <Button variant="ghost" size="icon-sm" aria-label={`Vazifa qo'shish: ${stage.name}`} onClick={onAdd} className="text-muted-foreground">
                  <PlusIcon />
                </Button>
              </ActionTooltip>
            </span>
          </header>
          <div className="px-2">
            {tasks.isPending && <Loading rows={2} />}
            {tasks.isError && <Failed error={tasks.error} onRetry={() => tasks.refetch()} />}
            {tasks.data &&
              (items.length === 0 ? (
                <p className="rounded-xl border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">Vazifa yo&apos;q</p>
              ) : (
                <ul aria-label={`${stage.name}: vazifalar`} className="grid gap-2">
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
          </div>
          <footer className="flex min-h-10 items-center justify-between gap-2 px-3 py-1.5 text-[0.8125rem] leading-5 text-muted-foreground">
            <span>Jami: {total ?? 0}</span>
            {tasks.hasNextPage && (
              <Button variant="outline" size="sm" className="bg-card" onClick={() => tasks.fetchNextPage()} disabled={tasks.isFetchingNextPage}>
                Yana
              </Button>
            )}
          </footer>
        </>
      )}
    </section>
  )
}
