"use client"

import type { ComponentProps, MouseEvent, ReactNode } from "react"
import { cn } from "@/lib/utils"

// MainButton is the prototype's full button: as wide as its place, 50px,
// 12px round and 17px semibold on a phone, 40px and 13px on the web; the
// accent (or a grey ghost, or the soft red of an irreversible act). While
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
        "flex h-[50px] w-full items-center justify-center gap-2 rounded-xl text-[17px] font-semibold outline-none transition-[transform,opacity,background-color] duration-150 ease-out-expo active:scale-[.98] focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-40 aria-disabled:pointer-events-none md:h-10 md:rounded-md md:text-[13px] md:font-medium",
        variant === "accent" && "bg-primary text-primary-foreground md:hover:bg-[color-mix(in_srgb,var(--primary)_88%,#000)]",
        variant === "ghost" && "bg-transparent text-muted-foreground md:hover:bg-ink-1 md:hover:text-foreground",
        variant === "red" && "bg-destructive-soft text-destructive",
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
// a sheet: it sticks to the bottom and keeps clear of the phone's bottom
// edge. A page's fades the content under it into the page's color (on a
// wide screen its button 380px wide at the column's right, no fade); a
// sheet's is the prototype's flat foot of the sheet, ruled off by a hairline
// on the web.
export function MainBar({ children, tone = "page", className }: { children: ReactNode; tone?: "page" | "sheet"; className?: string }) {
  return (
    <div
      data-slot="main-bar"
      className={cn(
        "sticky bottom-0 z-[5] -mx-4 mt-auto flex flex-col gap-1 px-4 pt-3 pb-safe-7",
        tone === "page"
          ? "bg-gradient-to-t from-(--fade) from-55% to-transparent md:mx-0 md:items-end md:bg-none md:px-0 md:pb-7 md:[&>*]:max-w-[380px]"
          : "bg-sheet pt-1 md:-mx-5 md:border-t md:border-line-faint md:px-5 md:pt-3 md:pb-4",
        className,
      )}
    >
      {children}
    </div>
  )
}
