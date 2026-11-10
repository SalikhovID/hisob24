"use client"

import type { ComponentProps } from "react"
import { maskAmount } from "@/lib/amount-input"

// AmountInput is a money field's input: what is typed in it is masked
// (lib/amount-input.ts), and it is the masked text that is handed over.
export function AmountInput({
  value,
  onChange,
  ...input
}: Omit<ComponentProps<"input">, "value" | "onChange"> & { value: string; onChange: (value: string) => void }) {
  return <input {...input} value={value} onChange={(event) => onChange(maskAmount(event.target.value))} />
}
