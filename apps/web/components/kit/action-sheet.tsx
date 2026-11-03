"use client"

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { CheckIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export interface ActionItem {
  label: string
  onSelect: () => void
  // danger is red (deleting); checked marks the current one among states
  // (a location, a stage); dot is a color beside the name (a stage's).
  danger?: boolean
  checked?: boolean
  dot?: string
  disabled?: boolean
}

// A list of the sheet: a flat white card, 14px round (floating on the web).
const card = "overflow-hidden rounded-[14px] bg-popover md:shadow-float"

// ActionSheet is the iOS action sheet: what can be done with a record (edit,
// deactivate, delete) or which state to put it in, in a flat white list at
// the bottom of the screen, its rows apart by hairlines, «Bekor qilish»
// under it. A choice does its thing and closes the sheet.
export function ActionSheet({
  open,
  onOpenChange,
  title,
  items,
  cancelLabel = "Bekor qilish",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: ReactNode
  items: ActionItem[]
  cancelLabel?: string
}) {
  const choice = items.some((item) => item.checked !== undefined)
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          data-slot="action-sheet-overlay"
          forceRender
          className="fixed inset-0 z-50 bg-scrim transition-opacity duration-250 data-starting-style:opacity-0 data-ending-style:opacity-0"
        />
        <DialogPrimitive.Popup
          data-slot="action-sheet"
          aria-label={title === undefined ? "Amallar" : undefined}
          className="fixed inset-x-2 bottom-3 z-50 mx-auto flex w-auto max-w-[480px] flex-col gap-2 outline-none transition-transform duration-[380ms] ease-drawer data-starting-style:translate-y-[110%] data-ending-style:translate-y-[110%]"
        >
          <div role="menu" className={card}>
            {title !== undefined && (
              <>
                <DialogPrimitive.Title className="px-4 pt-3.5 pb-3 text-center text-[13px] leading-snug font-normal text-muted-foreground md:text-[12px]">{title}</DialogPrimitive.Title>
              </>
            )}
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role={choice ? "menuitemradio" : "menuitem"}
                aria-checked={choice ? item.checked === true : undefined}
                data-danger={item.danger || undefined}
                disabled={item.disabled}
                onClick={() => {
                  onOpenChange(false)
                  item.onSelect()
                }}
                className={cn(
                  "relative flex min-h-14 w-full items-center justify-center gap-3 border-t border-separator px-3.5 text-[17px] text-accent-text outline-none first:border-t-0 active:bg-press focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset disabled:opacity-40 md:min-h-11 md:border-line-faint md:text-[13px] md:hover:bg-ink-1",
                  item.danger && "text-destructive",
                )}
              >
                {item.dot && <span aria-hidden="true" style={{ background: item.dot }} className="size-2.5 shrink-0 rounded-full" />}
                <span>{item.label}</span>
                {item.checked && <CheckIcon aria-hidden="true" strokeWidth={2.4} className="absolute right-4 size-5 text-accent-text" />}
              </button>
            ))}
          </div>
          <div className={card}>
            <DialogPrimitive.Close className="flex min-h-14 w-full items-center justify-center text-[17px] font-semibold text-accent-text outline-none active:bg-press focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset md:min-h-11 md:text-[13px] md:hover:bg-ink-1">
              {cancelLabel}
            </DialogPrimitive.Close>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
