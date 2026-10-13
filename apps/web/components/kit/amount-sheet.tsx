"use client"

import { DeleteIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { Amount } from "./amount"
import { MainButton } from "./main-button"

export type Key = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "," | "del"

const KEYS: Key[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "del"]

// nextAmount is the amount after a key: digits as typed (eleven at most
// before the comma, two after it), one comma, no zero in front.
export function nextAmount(current: string, key: Key | string): string {
  if (key === "del") return current.slice(0, -1)
  if (key === ",") return current.includes(",") ? current : `${current || "0"},`
  const [whole, decimals] = current.split(",")
  if (decimals !== undefined) return decimals.length < 2 ? current + key : current
  if (whole.length >= 11) return current
  return (current === "0" ? "" : current) + key
}

// amountToDecimal is the typed amount as the API takes it: a dot for the comma.
export const amountToDecimal = (typed: string) => typed.replace(",", ".")

// decimalToTyped is an amount as the API writes it ("1200.50") typed back
// the keypad's way ("1200,5"): a comma, the trailing zeros dropped.
export function decimalToTyped(decimal: string): string {
  const [whole, decimals = ""] = decimal.split(".")
  const kept = decimals.replace(/0+$/, "")
  return kept ? `${whole},${kept}` : whole
}

// Keypad is the prototype's keypad: the digits, the comma and delete.
export function Keypad({ onKey }: { onKey: (key: Key) => void }) {
  return (
    <div role="group" aria-label="Raqamlar" data-slot="keypad" className="grid grid-cols-3 gap-1.5 pt-2 pb-1">
      {KEYS.map((key) => (
        <button
          key={key}
          type="button"
          aria-label={key === "del" ? "O'chirish" : key === "," ? "vergul" : key}
          onClick={() => onKey(key)}
          className={cn(
            "grid h-[52px] place-items-center rounded-main text-[25px] font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            key === "," || key === "del" ? "bg-transparent" : "bg-sheet-cell shadow-[0_1px_0_rgba(0,0,0,.08)] active:bg-press",
          )}
        >
          {key === "del" ? <DeleteIcon aria-hidden="true" strokeWidth={1.9} className="size-[26px]" /> : key}
        </button>
      ))}
    </div>
  )
}

// AmountSheet is the sheet an amount is typed in (a payment): the figure
// large with a caret, a hint under it (the debt, with «To'liq» to fill it),
// rows for whatever else the document needs (children: the day, a note),
// the keypad, and the main button.
export function AmountSheet({
  open,
  onOpenChange,
  title,
  subtitle,
  value,
  onChange,
  hint,
  onFull,
  error,
  unit = "so'm",
  children,
  submitLabel,
  onSubmit,
  pending,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  subtitle?: string
  value: string
  onChange: (value: string) => void
  hint?: ReactNode
  onFull?: () => void
  error?: string
  unit?: string
  children?: ReactNode
  submitLabel: string
  onSubmit: () => void
  pending: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent tall>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {subtitle && <span className="text-sm text-muted-foreground">{subtitle}</span>}
        </DialogHeader>
        <div data-slot="amount-input" className="px-0 pt-4 pb-2 text-center">
          <Amount value={value === "" ? "0" : amountToDecimal(value)} unit={unit} size="input" caret muted={value === ""} />
          {(hint || onFull) && (
            <p className="mt-2.5 text-sm text-muted-foreground">
              {hint}
              {onFull && (
                <>
                  {hint && " · "}
                  <button type="button" onClick={onFull} className="min-h-8 text-sm font-semibold text-primary">
                    To&apos;liq
                  </button>
                </>
              )}
            </p>
          )}
          {error && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        {children}
        <Keypad onKey={(key) => onChange(nextAmount(value, key))} />
        <DialogFooter>
          <MainButton onClick={onSubmit} pending={pending}>
            {submitLabel}
          </MainButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
