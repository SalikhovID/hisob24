"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { cn } from "cn"
import { XIcon } from "lucide-react"

// The dialogs are the prototype's sheets of glass (the sheet's tint over a
// deep blur, a white edge): they come up from the bottom of
// the screen (on a wide screen too, 480px wide in the middle), a grab
// handle on top, the close button at the top left, the title centered, the
// body scrolling under a sticky head, the main button in a sticky footer.
// Inside a sheet the page's surfaces are the sheet's own (as the
// prototype's .sheet redefines --cell and --bg): a group is a sheet cell.
// The API is the one from before (Dialog, DialogContent, DialogHeader,
// DialogTitle, DialogDescription, DialogFooter), so every dialog of the app
// is a sheet from here on.

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
      className={cn(
        "fixed inset-0 isolate z-50 bg-scrim transition-opacity duration-300 data-starting-style:opacity-0 data-ending-style:opacity-0",
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
  right,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
  // tall: the sheet takes the whole height (a long form, a list to search).
  tall?: boolean
  // right: a control at the head's right (a second action).
  right?: React.ReactNode
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        data-tall={tall || undefined}
        className={cn(
          "group/sheet fixed inset-x-2 bottom-2 z-50 mx-auto flex [--background:var(--sheet)] [--card:var(--sheet-cell)] max-h-[calc(100dvh-18px)] w-auto max-w-[480px] flex-col overflow-hidden rounded-sheet bg-sheet text-foreground shadow-[0_-12px_50px_rgba(60,40,120,.18),inset_0_0_0_1px_var(--glass-edge),inset_0_1.5px_0_var(--glass-edge)] backdrop-blur-[40px] backdrop-saturate-[1.8] outline-none transition-transform duration-[440ms] ease-drawer data-starting-style:translate-y-[105%] data-ending-style:translate-y-[105%] data-tall:h-[calc(100dvh-18px)]",
          className
        )}
        {...props}
      >
        <span aria-hidden="true" data-slot="dialog-grab" className="absolute top-1.5 left-1/2 z-10 h-[5px] w-9 -translate-x-1/2 rounded-full bg-muted-foreground/35" />
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            aria-label="Yopish"
            className="absolute top-3 left-3 z-10 grid size-11 place-items-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="grid size-9 place-items-center rounded-full glass-chip text-foreground">
              <XIcon strokeWidth={2.6} className="size-4" />
            </span>
          </DialogPrimitive.Close>
        )}
        {right && (
          <span data-slot="dialog-right" className="absolute top-3 right-3 z-10 flex h-11 items-center">
            {right}
          </span>
        )}
        <div data-slot="dialog-body" className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 pb-4 scrollbar-hide has-[>[data-slot=dialog-footer]]:pb-0 has-[>[data-slot=sheet-form]>[data-slot=dialog-footer]]:pb-0 [&>*]:shrink-0">
          {children}
        </div>
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

// DialogHeader is the sheet's head: it stays at the top while the body
// scrolls, the title centered between the close button and the right slot.
// It has no fill of its own (the sheet's glass would show twice): what
// scrolls under it is frosted instead.
function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("sticky top-0 z-[1] -mx-4 mb-2 flex flex-col gap-1 px-14 pt-5 pb-2 text-center backdrop-blur-[24px]", className)}
      {...props}
    />
  )
}

// DialogFooter is the main button's bar at the bottom of the sheet. It
// sticks to the body's bottom edge; the body then has no padding under it
// (a sticky box keeps clear of its scroller's padding). Like the head it
// has no fill of its own: what scrolls under it is frosted.
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
        "sticky bottom-0 z-[1] -mx-4 mt-auto flex flex-col gap-1 px-4 pt-3 pb-4 backdrop-blur-[24px] [&>*]:w-full",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close className="h-11 rounded-main text-base font-semibold text-primary">
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
      className={cn("text-base leading-tight font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm leading-snug text-muted-foreground *:[a]:underline *:[a]:underline-offset-3", className)}
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
