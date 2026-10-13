"use client"

import { type CSSProperties, useLayoutEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

// groupDigits puts a no-break space between the thousands of a whole number.
export const groupDigits = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ")

// splitAmount takes an amount as the API writes it ("1250000.50") apart
// into its grouped whole part and its decimals after a comma, which are
// left out when they are all zero.
export function splitAmount(value: string): { whole: string; decimals: string } {
  const [whole, decimals = ""] = value.split(".")
  return { whole: groupDigits(whole), decimals: /^0*$/.test(decimals) ? "" : `,${decimals}` }
}

// Amount is the prototype's large figure: the whole part big, the decimals
// smaller, the unit in the hint color; the whole shrinks to fit its box
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
  // scaled down, never below half.
  useLayoutEffect(() => {
    const node = ref.current
    const parent = node?.parentElement
    if (!node || !parent) return
    const fit = () => {
      node.style.setProperty("--k", "1")
      const room = parent.clientWidth - 8
      const width = node.scrollWidth
      const next = room <= 0 || width === 0 ? 1 : Math.max(0.5, Math.min(1, room / width))
      // Set on the node too: React re-applies the style prop only when the
      // state changes, and a resize that keeps the scale would leave it at 1.
      node.style.setProperty("--k", String(next))
      setScale(next)
    }
    fit()
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(fit)
    observer?.observe(parent)
    return () => observer?.disconnect()
  }, [whole, decimals, unit])

  const big = size === "hero" ? 56 : 52
  const small = size === "hero" ? 40 : 52
  return (
    <span
      ref={ref}
      data-slot="amount"
      style={{ "--k": String(scale) } as CSSProperties}
      className={cn("inline-flex items-baseline justify-center leading-none font-bold tracking-[-0.035em] whitespace-nowrap", muted && "text-muted-foreground", className)}
    >
      <span data-slot="amount-whole" style={{ fontSize: `calc(${big}px * var(--k))` }}>
        {whole}
      </span>
      {decimals && (
        <span data-slot="amount-decimals" style={{ fontSize: `calc(${small}px * var(--k))` }}>
          {decimals}
        </span>
      )}
      {caret && <span aria-hidden="true" className="mx-0.5 inline-block h-[46px] w-[2.5px] self-center rounded-sm bg-primary motion-safe:animate-[blink_1s_steps(1)_infinite]" />}
      <span data-slot="amount-unit" className="ml-[calc(9px*var(--k))] font-semibold tracking-[-0.01em] text-muted-foreground" style={{ fontSize: "calc(32px * var(--k))" }}>
        {" "}
        {unit}
      </span>
    </span>
  )
}
