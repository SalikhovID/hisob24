"use client"

import { ChevronRightIcon } from "lucide-react"
import Link from "next/link"
import { type ComponentProps, type CSSProperties, createContext, type ReactNode, useContext } from "react"
import { cn } from "@/lib/utils"
import { moveTo, stepInto } from "@/lib/moves"

// The hairline between rows starts after the row's media: an avatar (icon),
// a tile icon (tile), or at the text (none). globals.css draws it at --inset.
const insets = { none: "16px", icon: "68px", tile: "56px" } as const

// Whether the rows stand in a list, in which case each takes a list item.
const ListContext = createContext(false)

// Group is the prototype's grouped block: a frosted glass card of rows
// (surface) with hairlines between them. Like every block of a page it carries its own
// space under it (24px), so a page stacks its blocks as they come. With a label it is a list (the rows become its
// items); as "dl" it holds key-value rows.
export function Group({
  inset = "none",
  as = "div",
  label,
  className,
  style,
  children,
}: {
  inset?: keyof typeof insets
  as?: "div" | "dl"
  label?: string
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  const styles = { ...style, "--inset": insets[inset] } as CSSProperties
  const classes = cn("mb-6 overflow-hidden rounded-group surface", className)
  if (label) {
    return (
      <ListContext value={true}>
        <ul role="list" aria-label={label} data-slot="group" data-inset={inset} className={classes} style={styles}>
          {children}
        </ul>
      </ListContext>
    )
  }
  const Tag = as
  return (
    <ListContext value={false}>
      <Tag data-slot="group" data-inset={inset} className={classes} style={styles}>
        {children}
      </Tag>
    </ListContext>
  )
}

export interface RowProps {
  // media leads the row: an avatar, a tile icon, a colored dot.
  media?: ReactNode
  title: ReactNode
  // badge stands beside the title; sub is the line under it.
  badge?: ReactNode
  sub?: ReactNode
  // end is the value at the right (an amount, a date, a status), endSub the
  // line under it.
  end?: ReactNode
  endSub?: ReactNode
  // chevron: by default a row with a way in shows one; false hides it.
  chevron?: boolean
  href?: string
  onClick?: () => void
  // link is the title alone in the accent color, at the left ("Barcha
  // buyurtmalar", "Qo'shish"); accent and danger are centered accent or red
  // text: the rows that do one thing ("Standart holat", "Mijozni o'chirish").
  variant?: "default" | "link" | "accent" | "danger"
  compact?: boolean
  disabled?: boolean
  className?: string
  "aria-label"?: string
}

const variants = {
  default: "",
  link: "text-primary",
  accent: "justify-center font-medium text-primary",
  danger: "justify-center font-medium text-destructive",
}

// Row is one row of a group: media, a title with a badge and a line under
// it, a value at the right and a chevron. With href it is a link, with
// onClick a button, otherwise a plain row; a pressed row darkens.
export function Row({
  media,
  title,
  badge,
  sub,
  end,
  endSub,
  chevron,
  href,
  onClick,
  variant = "default",
  compact = false,
  disabled = false,
  className,
  ...aria
}: RowProps) {
  const inList = useContext(ListContext)
  const interactive = href !== undefined || onClick !== undefined
  const showChevron = chevron ?? (interactive && variant === "default")
  const plain = variant !== "default"
  const body = plain ? (
    <>
      <span data-slot="row-title" className={cn("truncate", variant === "link" && "flex-1")}>
        {title}
      </span>
      {showChevron && <ChevronRightIcon aria-hidden="true" strokeWidth={2.6} className="-mr-1 size-[18px] shrink-0 opacity-60" />}
    </>
  ) : (
    <>
      {media}
      <span data-slot="row-body" className="min-w-0 flex-1">
        <span data-slot="row-title" className="flex min-w-0 items-center gap-1.5 leading-tight font-medium">
          <span className="truncate">{title}</span>
          {badge && " "}
          {badge}
        </span>
        {sub && " "}
        {sub && (
          <span data-slot="row-sub" className="mt-0.5 block truncate text-sm text-muted-foreground">
            {sub}
          </span>
        )}
      </span>
      {(end || endSub) && " "}
      {(end || endSub) && (
        <span data-slot="row-end" className="max-w-[52%] shrink-0 text-right">
          {end && (
            <span data-slot="row-value" className="block whitespace-nowrap">
              {end}
            </span>
          )}
          {end && endSub && " "}
          {endSub && (
            <span data-slot="row-end-sub" className="mt-0.5 block whitespace-nowrap text-sm text-muted-foreground">
              {endSub}
            </span>
          )}
        </span>
      )}
      {showChevron && (
        <ChevronRightIcon aria-hidden="true" strokeWidth={2.6} className="-ml-1 size-[18px] shrink-0 text-muted-foreground opacity-60" />
      )}
    </>
  )
  const classes = cn(
    "flex w-full items-center gap-3 px-4 py-2 text-left text-base text-foreground no-underline outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
    compact ? "min-h-12" : variant === "link" ? "min-h-[50px]" : "min-h-14",
    variants[variant],
    interactive && !disabled && "active:bg-press",
    disabled && "opacity-50",
    className,
  )
  const common = { "data-slot": "row", "data-variant": variant, className: classes, ...aria }
  const element =
    href !== undefined ? (
      <Link href={href} onClick={() => moveTo(stepInto(href))} aria-disabled={disabled || undefined} {...common}>
        {body}
      </Link>
    ) : onClick !== undefined ? (
      <button type="button" onClick={onClick} disabled={disabled} {...common}>
        {body}
      </button>
    ) : (
      <div {...common}>{body}</div>
    )
  return inList ? <li data-slot="row-item">{element}</li> : element
}

// KeyValue is a row of the "Ma'lumot" block: the name at the left, the
// value at the right in the hint color, a dash where there is none. It
// lives in a Group as "dl".
export function KeyValue({ label, value }: { label: ReactNode; value?: ReactNode }) {
  const present = value !== null && value !== undefined && value !== false && value !== ""
  return (
    <div data-slot="row" className="flex min-h-12 items-center gap-3 px-4 py-2 text-base">
      <dt className="min-w-0 flex-1 text-foreground">{label}</dt>
      <dd className="max-w-[62%] text-right text-muted-foreground [overflow-wrap:anywhere]">{present ? value : "—"}</dd>
    </div>
  )
}

// SectionHeading heads a block of a page, quietly as the prototype's (16px,
// not bold, the hint's grey): a heading at the left, an action (a button or
// a link) or a hint (a count) at the right.
export function SectionHeading({
  children,
  action,
  hint,
  className,
}: {
  children: ReactNode
  action?: ReactNode
  hint?: ReactNode
  className?: string
}) {
  return (
    <div data-slot="section-heading" className={cn("flex items-baseline justify-between gap-3 px-1 pb-2 text-muted-foreground", className)}>
      <h2 className="min-w-0 truncate text-[16px] font-medium">{children}</h2>
      {action && (
        <span className="shrink-0 text-[16px] font-medium text-primary [&_a]:text-primary [&_button]:min-h-8 [&_button]:text-primary">{action}</span>
      )}
      {hint !== undefined && (
        <span data-slot="section-hint" className="shrink-0 text-md text-muted-foreground">
          {hint}
        </span>
      )}
    </div>
  )
}

// Foot is the note under a group: what the block means or what to do next.
// Right after a group it tucks up to it.
export function Foot({ children, center = false, className }: { children: ReactNode; center?: boolean; className?: string }) {
  return (
    <p
      data-slot="foot"
      className={cn(
        "mb-6 px-4 text-xs leading-[1.4] text-muted-foreground [[data-slot=group]+&]:-mt-3.5 [&_a]:text-primary [&_button]:text-primary",
        center && "text-center",
        className,
      )}
    >
      {children}
    </p>
  )
}

export type GroupProps = ComponentProps<typeof Group>
