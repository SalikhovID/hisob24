"use client"

import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"

const SLOTS = [0, 1, 2, 3, 4, 5]

// CodeField is a login's six-digit code, a box a digit. It has no button:
// the sixth digit hands the code to onComplete.
export function CodeField({
  value,
  onChange,
  onComplete,
}: {
  value: string
  onChange: (value: string) => void
  onComplete: (code: string) => void
  invalid?: boolean
  disabled?: boolean
}) {
  return (
    <InputOTP
      aria-label="Kod"
      maxLength={6}
      value={value}
      onChange={onChange}
      onComplete={onComplete}
      containerClassName="w-full"
    >
      <InputOTPGroup className="w-full gap-2 has-aria-invalid:ring-0">
        {SLOTS.map((index) => (
          <InputOTPSlot
            key={index}
            index={index}
            className="h-14 flex-1 rounded-xl border text-2xl font-semibold tabular-nums first:rounded-l-xl last:rounded-r-xl"
          />
        ))}
      </InputOTPGroup>
    </InputOTP>
  )
}
