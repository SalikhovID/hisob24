"use client"

import type { ComponentProps } from "react"
import { maskAmount, maskedCaret } from "@/lib/amount-input"

// AmountInput is a money field's input: what is typed in it is masked
// (lib/amount-input.ts), and it is the masked text that is handed over. A
// value that is set, not typed (a price saved, a price offered), is shown
// masked as well; the field keeps it as it is until it is typed in. The
// caret stays after the digits it stood after.
export function AmountInput({
  value,
  onChange,
  ...input
}: Omit<ComponentProps<"input">, "value" | "onChange"> & { value: string; onChange: (value: string) => void }) {
  return (
    <input
      {...input}
      value={maskAmount(value)}
      onChange={(event) => {
        const field = event.currentTarget
        const typed = field.value
        const caret = maskedCaret(typed, field.selectionStart ?? typed.length)
        onChange(maskAmount(typed))
        // Showing the masked text sends the caret to its end; it is put back
        // once the text is in.
        queueMicrotask(() => field.setSelectionRange(caret, caret))
      }}
    />
  )
}
