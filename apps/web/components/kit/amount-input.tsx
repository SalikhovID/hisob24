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
        let typed = field.value
        let caret = field.selectionStart ?? typed.length
        // The space between thousands is no part of the number: a key that
        // took only it away would change nothing (it comes back), so the
        // digit beside it goes too.
        if (maskAmount(typed) === maskAmount(value)) {
          const { inputType } = event.nativeEvent as InputEvent
          if (inputType === "deleteContentBackward" && caret > 0) {
            typed = typed.slice(0, caret - 1) + typed.slice(caret)
            caret -= 1
          } else if (inputType === "deleteContentForward") {
            typed = typed.slice(0, caret) + typed.slice(caret + 1)
          }
        }
        const placed = maskedCaret(typed, caret)
        onChange(maskAmount(typed))
        // Showing the masked text sends the caret to its end; it is put back
        // once the text is in.
        queueMicrotask(() => field.setSelectionRange(placed, placed))
      }}
    />
  )
}
