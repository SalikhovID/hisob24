"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { cn } from "cn"
import { XIcon } from "lucide-react"

// The dialogs are the prototype's sheets: on a phone they come up from the
// bottom of the screen, the whole width, 38px round on top, a grab handle
// over them, in the page's own grey (the groups inside stay white); on a
// wide screen they are the prototype's dialog, 480px wide in the middle of
// the screen, 12px round, floating. The title stands at the left of the
// head, the close button (a plain icon) at its right; the body scrolls
// under the head, up and down only (a thumb cannot pull it to the side), the
// main button stands in the flat foot (ruled off by a hairline on the web).
// Behind it the rest of the screen is dimmed by the
// scrim; a sheet over a sheet draws its own (Base UI leaves a nested
// dialog's backdrop out unless forced). The API is the one from before
// (Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
// DialogFooter).

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      forceRender
      className={cn(
        "fixed inset-0 isolate z-50 bg-scrim transition-opacity duration-250 data-starting-style:opacity-0 data-ending-style:opacity-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  tall = false,
  full = false,
  right,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
  // tall: the sheet takes the whole height (a long form, a list to search).
  tall?: boolean
  // full: on a phone the sheet is a screen of its own (a long form that is
  // entered, not picked from): edge to edge, square, in from the right as a
  // page is, its head under what lies over the screen's top. On a wide
  // screen it is the dialog in the middle, as any.
  full?: boolean
  // right: a control at the head's right (a second action).
  right?: React.ReactNode
}) {
  // The close button and the control beside it stand level with the title:
  // under what lies over the top of a full screen.
  const top = full ? "top-[calc(var(--safe-top)_+_14px)] md:top-3" : "top-3.5 md:top-3"
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        data-tall={tall || undefined}
        data-full={full || undefined}
        className={cn(
          "group/sheet fixed z-50 flex [--background:var(--sheet)] [--card:var(--sheet-cell)] w-full flex-col overflow-hidden bg-sheet pb-safe text-foreground outline-none transition-[translate,scale,opacity] duration-[420ms] ease-drawer",
          full
            ? "inset-0 max-h-none rounded-none pt-safe max-md:data-starting-style:translate-x-full max-md:data-ending-style:translate-x-full md:pt-0"
            : "inset-x-0 bottom-0 max-h-[calc(100dvh-18px-var(--safe-top))] rounded-t-sheet data-starting-style:translate-y-full data-ending-style:translate-y-full data-tall:h-[calc(100dvh-18px-var(--safe-top))]",
          "md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:w-[480px] md:max-w-[calc(100%-32px)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:pb-0 md:shadow-float md:duration-300 md:ease-out-expo md:max-h-[calc(100dvh-64px)] md:data-tall:h-[calc(100dvh-64px)] md:data-starting-style:-translate-y-[48%] md:data-starting-style:scale-[.98] md:data-starting-style:opacity-0 md:data-ending-style:-translate-y-[48%] md:data-ending-style:scale-[.98] md:data-ending-style:opacity-0",
          className
        )}
        {...props}
      >
        {!full && (
          <span aria-hidden="true" data-slot="dialog-grab" className="absolute top-1.5 left-1/2 z-10 h-[5px] w-9 -translate-x-1/2 rounded-full bg-[rgba(60,60,67,.3)] md:hidden" />
        )}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            aria-label="Yopish"
            className={cn(
              "absolute right-3 z-10 grid size-[30px] place-items-center rounded-md text-icon outline-none hover:bg-ink-1 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
              top
            )}
          >
            <XIcon strokeWidth={2} className="size-[18px]" />
          </DialogPrimitive.Close>
        )}
        {right && (
          <span data-slot="dialog-right" className={cn("absolute right-12 z-10 flex h-[30px] items-center", top)}>
            {right}
          </span>
        )}
        <div data-slot="dialog-body" className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-x-none overscroll-y-contain touch-pan-y px-5 pb-5 scrollbar-hide has-[>[data-slot=dialog-footer]]:pb-0 has-[>[data-slot=sheet-form]>[data-slot=dialog-footer]]:pb-0 [&>*]:shrink-0">
          {children}
        </div>
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

// DialogHeader is the sheet's head: it stays at the top while the body
// scrolls, the title at its left, clear of the close button at its right.
// It wears the sheet's own color, so what scrolls under it is hidden.
function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("sticky top-0 z-[1] -mx-5 mb-2 flex flex-col gap-1 bg-sheet pt-5 pr-14 pb-1.5 pl-5 text-left md:pt-4", className)}
      {...props}
    />
  )
}

// DialogFooter is the main button's bar at the bottom of the sheet, its flat
// foot (ruled off by a hairline on the web). It sticks to the body's bottom
// edge; the body then has no padding under it (a sticky box keeps clear of
// its scroller's padding).
function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "sticky bottom-0 z-[1] -mx-5 mt-auto flex flex-col gap-1 bg-sheet px-4 pt-1 pb-4 md:border-t md:border-line-faint md:px-5 md:pt-3 [&>*]:w-full",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close className="h-11 rounded-main text-base font-medium text-muted-foreground md:h-8">
          Yopish
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-[17px] leading-tight font-semibold md:text-[15px]", className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-[13px] leading-snug text-muted-foreground *:[a]:underline *:[a]:underline-offset-3", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
