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

// The prototype's glass menu: 26px corners, a white edge all round and a
// light along its top, over a blur.
const glass =
  "rounded-[26px] bg-menu p-1.5 shadow-[var(--shadow),inset_0_0_0_1px_var(--glass-edge),inset_0_1px_0_var(--glass-edge)] backdrop-blur-[30px] backdrop-saturate-[1.8]"

// ActionSheet is the prototype's action sheet: what can be done with a
// record (edit, deactivate, delete) or which state to put it in, in a glass
// list at the bottom of the screen, «Bekor qilish» under it. A choice does
// its thing and closes the sheet.
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
          className="fixed inset-0 z-50 scrim transition-opacity duration-250 data-starting-style:opacity-0 data-ending-style:opacity-0"
        />
        <DialogPrimitive.Popup
          data-slot="action-sheet"
          aria-label={title === undefined ? "Amallar" : undefined}
          className="fixed inset-x-2 bottom-3 z-50 mx-auto flex w-auto max-w-[480px] flex-col gap-2 outline-none transition-transform duration-[380ms] ease-drawer data-starting-style:translate-y-[110%] data-ending-style:translate-y-[110%]"
        >
          <div role="menu" className={glass}>
            {title !== undefined && (
              <>
                <DialogPrimitive.Title className="px-4 pt-2.5 pb-2 text-center text-xs leading-snug font-normal text-muted-foreground">{title}</DialogPrimitive.Title>
                <hr className="mx-2.5 mb-1 h-px border-0 bg-border" />
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
                  "relative flex min-h-[52px] w-full items-center justify-center gap-3 rounded-[16px] px-3.5 text-base text-foreground outline-none active:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-45",
                  item.danger && "text-destructive",
                )}
              >
                {item.dot && <span aria-hidden="true" style={{ background: item.dot }} className="size-2.5 shrink-0 rounded-full" />}
                <span>{item.label}</span>
                {item.checked && <CheckIcon aria-hidden="true" strokeWidth={2.6} className="absolute right-4 size-5 text-primary" />}
              </button>
            ))}
          </div>
          <div className={glass}>
            <DialogPrimitive.Close className="flex min-h-[52px] w-full items-center justify-center rounded-[16px] text-base font-semibold text-foreground outline-none active:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
              {cancelLabel}
            </DialogPrimitive.Close>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
