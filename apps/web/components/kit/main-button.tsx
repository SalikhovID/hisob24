"use client"

import type { ComponentProps, MouseEvent, ReactNode } from "react"
import { cn } from "@/lib/utils"

// MainButton is the prototype's main button: a full-width glossy capsule,
// 54px tall, in the accent (or a ghost in the accent color, or the red
// capsule for an irreversible act). While
// its request is on its way it is busy: it says so, keeps the focus (a
// button the browser disables cannot hold it, and whoever pressed Enter on
// it would be dropped to the top of the page), shows a spinner and takes no
// press.
export function MainButton({
  variant = "accent",
  pending = false,
  disabled,
  type = "button",
  onClick,
  className,
  children,
  ...props
}: Omit<ComponentProps<"button">, "onClick"> & {
  variant?: "accent" | "ghost" | "red"
  pending?: boolean
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void
}) {
  return (
    <button
      type={type}
      data-slot="main-button"
      data-variant={variant}
      aria-busy={pending || undefined}
      aria-disabled={pending || undefined}
      disabled={disabled}
      onClick={(event) => {
        if (pending) {
          event.preventDefault()
          return
        }
        onClick?.(event)
      }}
      className={cn(
        "flex h-[54px] w-full items-center justify-center gap-2 rounded-full text-base font-semibold outline-none transition-[transform,opacity] duration-150 ease-out-expo active:scale-[.98] focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 aria-disabled:pointer-events-none",
        variant === "accent" && "glossy",
        variant === "ghost" && "h-11 bg-transparent text-primary",
        variant === "red" && "glossy-red",
        className,
      )}
      {...props}
    >
      {pending && (
        <>
          <span aria-hidden="true" className="size-5 animate-spin rounded-full border-[2.4px] border-current border-r-transparent motion-reduce:animate-none" />
          <span className="sr-only">Yuborilmoqda</span>
        </>
      )}
      {children}
    </button>
  )
}

// MainBar is the bar the main button stands in at the bottom of a page or
// a sheet: it sticks to the bottom, fades the content under it and keeps
// clear of the phone's bottom edge. On a wide screen a page's bar is the
// prototype's web view's: its button 380px wide at the column's right, no
// fade; a sheet's keeps a button's width at its left. tone "sheet" fades
// into a sheet's own background.
export function MainBar({ children, tone = "page", className }: { children: ReactNode; tone?: "page" | "sheet"; className?: string }) {
  return (
    <div
      data-slot="main-bar"
      className={cn(
        "sticky bottom-0 z-[5] -mx-4 mt-auto flex flex-col gap-1 px-4 pt-3 pb-safe-7",
        tone === "page"
          ? "bg-gradient-to-t from-(--fade) from-55% to-transparent md:mx-0 md:items-end md:bg-none md:px-0 md:pb-7 md:[&>*]:max-w-[380px]"
          : "bg-gradient-to-t from-sheet from-70% to-transparent md:items-start md:[&>*]:max-w-sm",
        className,
      )}
    >
      {children}
    </div>
  )
}
