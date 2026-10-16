"use client"

import { type CSSProperties, useLayoutEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

// groupDigits puts a no-break space between the thousands of a whole number.
export const groupDigits = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ")

// splitAmount takes an amount as the API writes it ("1250000.50") apart
// into its grouped whole part and its decimals after a comma, which are
// left out when they are all zero; below zero with a real minus sign.
export function splitAmount(value: string): { whole: string; decimals: string } {
  const negative = value.startsWith("-")
  const [whole, decimals = ""] = (negative ? value.slice(1) : value).split(".")
  return { whole: `${negative ? "−" : ""}${groupDigits(whole)}`, decimals: /^0*$/.test(decimals) ? "" : `,${decimals}` }
}

// Amount is the prototype's large figure: the whole part big, the decimals
// smaller, the unit in the hint's grey; the whole shrinks to fit its box
// (down to half) when it is too long. size "input" is the keypad's, with a
// caret after the digits.
export function Amount({
  value,
  unit,
  size = "hero",
  caret = false,
  muted = false,
  className,
}: {
  value: string
  unit: string
  size?: "hero" | "input"
  caret?: boolean
  muted?: boolean
  className?: string
}) {
  const { whole, decimals } = splitAmount(value)
  const ref = useRef<HTMLSpanElement>(null)
  const [scale, setScale] = useState(1)

  // The figure is measured at full size against its parent; a longer one is
  // scaled down, never below half. It is fitted again only when the parent's
  // width changes: its height follows the figure's own scaling, and fitting
  // on that would rock the scale back and forth with every frame.
  useLayoutEffect(() => {
    const node = ref.current
    const parent = node?.parentElement
    if (!node || !parent) return
    let fitted = -1
    const fit = () => {
      node.style.setProperty("--k", "1")
      // The room is the box's content width (its padding is not room), less a margin.
      const style = getComputedStyle(parent)
      const content = parent.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0)
      fitted = content
      const room = content - 8
      const width = node.scrollWidth
      const next = room <= 0 || width === 0 ? 1 : Math.max(0.5, Math.min(1, room / width))
      // Set on the node too: React re-applies the style prop only when the
      // state changes, and a resize that keeps the scale would leave it at 1.
      node.style.setProperty("--k", String(next))
      setScale(next)
    }
    fit()
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(([entry]) => {
            if (Math.abs(entry.contentRect.width - fitted) >= 0.5) fit()
          })
    observer?.observe(parent)
    return () => observer?.disconnect()
  }, [whole, decimals, unit])

  // A hero's figure takes its size from its box when the box gives one (a
  // hero on a wide screen); the keypad's is its own.
  const big = size === "hero" ? "var(--amount-big, 56px)" : "52px"
  const small = size === "hero" ? "var(--amount-small, 40px)" : "52px"
  return (
    <span
      ref={ref}
      data-slot="amount"
      style={{ "--k": String(scale) } as CSSProperties}
      className={cn("inline-flex items-baseline justify-center leading-none font-bold tracking-[-0.035em] whitespace-nowrap", muted && "text-muted-foreground", className)}
    >
      <span data-slot="amount-whole" style={{ fontSize: `calc(${big} * var(--k))` }}>
        {whole}
      </span>
      {decimals && (
        <span data-slot="amount-decimals" style={{ fontSize: `calc(${small} * var(--k))` }}>
          {decimals}
        </span>
      )}
      {caret && <span aria-hidden="true" className="mx-0.5 inline-block h-[46px] w-[2.5px] self-center rounded-sm bg-primary motion-safe:animate-[blink_1s_steps(1)_infinite]" />}
      <span data-slot="amount-unit" className="ml-[calc(9px*var(--k))] font-medium tracking-[-0.01em] text-muted-foreground" style={{ fontSize: "calc(26px * var(--k))" }}>
        {" "}
        {unit}
      </span>
    </span>
  )
}
