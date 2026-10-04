"use client"

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVerticalIcon } from "lucide-react"
import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from "react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface SortableListProps<T> {
  // label names the list for assistive technology.
  label: string
  items: readonly T[]
  getId: (item: T) => string
  // getLabel is the item's name, for its handle and for what is said aloud.
  getLabel: (item: T) => string
  // onReorder gets the ids in their new order; items bring it back.
  onReorder: (ids: string[]) => void
  // renderItem draws an item's row; handle is its drag handle, to be placed
  // where it fits.
  renderItem: (item: T, handle: ReactNode) => ReactNode
  disabled?: boolean
  className?: string
}

const instructions =
  "Tutqichni sudrang yoki yuqoriga va pastga strelkalar bilan siljiting. Home boshiga, End oxiriga olib boradi."

// SortableList is a list people put in order: by dragging an item's handle
// (a mouse, a pen, a finger) or, with the handle in focus, with the arrow
// keys; Home and End take the item to either end. Every move is said aloud.
// The order is the caller's: onReorder gets the new ids, and items bring
// them back.
export function SortableList<T>({
  label,
  items,
  getId,
  getLabel,
  onReorder,
  renderItem,
  disabled = false,
  className,
}: SortableListProps<T>) {
  const descriptionId = useId()
  const ids = items.map(getId)
  const [announcement, setAnnouncement] = useState("")
  const handles = useRef(new Map<string, HTMLButtonElement>())
  const focusAfterMove = useRef<string | null>(null)
  // A press that moves a little is a drag; a finger that rests first is a
  // drag too, so the page still scrolls under a passing thumb.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  )

  // The moved item keeps the focus, so the next key moves it again.
  useEffect(() => {
    const id = focusAfterMove.current
    if (id === null) return
    focusAfterMove.current = null
    handles.current.get(id)?.focus()
  })

  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= ids.length) return
    focusAfterMove.current = ids[from]
    onReorder(arrayMove(ids, from, to))
    setAnnouncement(`${getLabel(items[from])}: ${ids.length} tadan ${to + 1}-o'rinda`)
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    move(ids.indexOf(String(active.id)), ids.indexOf(String(over.id)))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      // The list says its own moves, once, in its own words.
      accessibility={{
        announcements: { onDragStart: () => "", onDragOver: () => "", onDragEnd: () => "", onDragCancel: () => "" },
        screenReaderInstructions: { draggable: instructions },
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul data-slot="sortable-list" aria-label={label} className={className}>
          {items.map((item, index) => (
            <SortableItem
              key={getId(item)}
              id={getId(item)}
              disabled={disabled}
              handleLabel={`${getLabel(item)}: tartibini o'zgartirish`}
              descriptionId={descriptionId}
              registerHandle={(node) => {
                if (node) handles.current.set(getId(item), node)
                else handles.current.delete(getId(item))
              }}
              onMove={(to) => move(index, to === "first" ? 0 : to === "last" ? ids.length - 1 : index + to)}
            >
              {(handle) => renderItem(item, handle)}
            </SortableItem>
          ))}
        </ul>
      </SortableContext>
      <span id={descriptionId} className="sr-only">
        {instructions}
      </span>
      <div aria-live="polite" aria-atomic className="sr-only">
        {announcement}
      </div>
    </DndContext>
  )
}

const keys: Record<string, -1 | 1 | "first" | "last"> = { ArrowUp: -1, ArrowDown: 1, Home: "first", End: "last" }

function SortableItem({
  id,
  disabled,
  handleLabel,
  descriptionId,
  registerHandle,
  onMove,
  children,
}: {
  id: string
  disabled: boolean
  handleLabel: string
  descriptionId: string
  registerHandle: (node: HTMLButtonElement | null) => void
  onMove: (to: -1 | 1 | "first" | "last") => void
  children: (handle: ReactNode) => ReactNode
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  })
  const handle = (
    <button
      type="button"
      ref={(node) => {
        setActivatorNodeRef(node)
        registerHandle(node)
      }}
      {...attributes}
      {...listeners}
      // A plain button: the arrow keys move the item, dnd-kit's own keyboard
      // sensor is not used.
      role="button"
      aria-roledescription={undefined}
      aria-describedby={descriptionId}
      aria-label={handleLabel}
      disabled={disabled}
      data-slot="sortable-handle"
      className={cn(
        buttonVariants({ variant: "ghost", size: "icon" }),
        "shrink-0 cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing max-md:size-9 pointer-coarse:size-9",
      )}
      onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
        const to = keys[event.key]
        if (to === undefined) return
        event.preventDefault()
        onMove(to)
      }}
    >
      <GripVerticalIcon />
    </button>
  )
  return (
    <li
      ref={setNodeRef}
      data-slot="sortable-item"
      data-dragging={isDragging || undefined}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("relative", isDragging && "z-10 bg-card opacity-90 shadow-md")}
    >
      {children(handle)}
    </li>
  )
}
