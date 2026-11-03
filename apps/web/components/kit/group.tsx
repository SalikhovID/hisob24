"use client"

import { ChevronRightIcon } from "lucide-react"
import Link from "next/link"
import { type ComponentProps, type CSSProperties, createContext, type ReactNode, useContext } from "react"
import { cn } from "@/lib/utils"
import { moveTo, stepInto } from "@/lib/moves"

// What leads a group's rows (an avatar, a tile icon, nothing): the
// prototype draws the hairline between them 16px in whatever it is
// (globals.css), so this only marks the group (data-inset).
type Inset = "none" | "icon" | "tile"

// Whether the rows stand in a list, in which case each takes a list item.
const ListContext = createContext(false)

// Group is the prototype's grouped block: a flat card of rows (surface) with
// hairlines between them, 12px round on a phone; on the web 10px round,
// ringed, its rows 4px in (they round on hover). Like every block of a page
// it carries its own space under it (24px), so a page stacks its blocks as
// they come. With a label it is a list (the rows become its items); as "dl"
// it holds key-value rows.
export function Group({
  inset = "none",
  as = "div",
  label,
  className,
  style,
  children,
}: {
  inset?: Inset
  as?: "div" | "dl"
  label?: string
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  const styles = style
  const classes = cn("mb-6 overflow-hidden rounded-group surface md:rounded-lg md:p-1", className)
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
// onClick a button, otherwise a plain row; a pressed row darkens. On a phone
// it is the prototype's 52px iOS row (a plain 17px title, a 15px line); on
// the web a 48px round row (a medium 13px title, a 12px line) that tints
// under the pointer.
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
        <span data-slot="row-title" className="flex min-w-0 items-center gap-1.5 leading-tight font-normal md:font-medium">
          <span className="truncate">{title}</span>
          {badge && " "}
          {badge}
        </span>
        {sub && " "}
        {sub && (
          <span data-slot="row-sub" className="mt-0.5 block truncate text-md text-muted-foreground">
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
            <span data-slot="row-end-sub" className="mt-0.5 block whitespace-nowrap text-md text-muted-foreground">
              {endSub}
            </span>
          )}
        </span>
      )}
      {showChevron && (
        <ChevronRightIcon aria-hidden="true" strokeWidth={2} className="-ml-1 size-4 shrink-0 text-icon-faint" />
      )}
    </>
  )
  const classes = cn(
    "flex w-full items-center gap-3 px-4 py-2.5 text-left text-base text-foreground no-underline outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset md:gap-2.5 md:rounded-md md:px-3 md:py-2",
    compact ? "min-h-11 md:min-h-10" : "min-h-[52px] md:min-h-12",
    variants[variant],
    interactive && !disabled && "active:bg-press md:hover:bg-ink-1",
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
// value at the right, a dash where there is none. On a phone the name is in
// the ink and the value grey (the prototype's iOS rows); on the web the name
// grey and the value in the ink. It lives in a Group as "dl".
export function KeyValue({ label, value }: { label: ReactNode; value?: ReactNode }) {
  const present = value !== null && value !== undefined && value !== false && value !== ""
  return (
    <div data-slot="row" className="flex min-h-11 items-center gap-4 px-4 py-[11px] text-base md:min-h-0 md:px-3 md:py-[9px]">
      <dt className="min-w-0 flex-1 text-foreground md:text-muted-foreground">{label}</dt>
      <dd className="max-w-[62%] text-right text-muted-foreground tabular-nums [overflow-wrap:anywhere] md:text-foreground">{present ? value : "—"}</dd>
    </div>
  )
}

// SectionHeading heads a block of a page, quietly as the prototype's group
// title (13px grey on a phone, 16px in from the group's edge; 12px medium on
// the web): a heading at the left, an action (a button or a link, in the
// accent) or a hint (a count) at the right.
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
    <div data-slot="section-heading" className={cn("flex min-h-5 items-center justify-between gap-3 px-4 pb-2 text-muted-foreground md:px-0", className)}>
      <h2 className="min-w-0 truncate text-[13px] font-normal md:text-[12px] md:font-medium">{children}</h2>
      {action && (
        <span className="shrink-0 text-[13px] font-medium text-accent-text [&_a]:text-accent-text [&_button]:min-h-8 [&_button]:text-accent-text">{action}</span>
      )}
      {hint !== undefined && (
        <span data-slot="section-hint" className="shrink-0 text-md text-muted-foreground">
          {hint}
        </span>
      )}
    </div>
  )
}

// Foot is the note under a group, the prototype's faint 12px line: what the
// block means or what to do next. Right after a group it tucks up to it.
export function Foot({ children, center = false, className }: { children: ReactNode; center?: boolean; className?: string }) {
  return (
    <p
      data-slot="foot"
      className={cn(
        "mb-6 px-4 text-[12px] leading-[1.4] text-faint md:px-0 [[data-slot=group]+&]:-mt-3.5 [&_a]:text-accent-text [&_button]:text-accent-text",
        center && "text-center",
        className,
      )}
    >
      {children}
    </p>
  )
}

export type GroupProps = ComponentProps<typeof Group>
