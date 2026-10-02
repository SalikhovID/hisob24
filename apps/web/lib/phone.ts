const PREFIX = "+998 "
const GROUPS = [2, 3, 2, 2]

// formatPhoneInput shows what was typed in the phone field as +998 90 123 45 67.
// The prefix stays put; a pasted number that repeats 998 loses it.
export function formatPhoneInput(value: string): string {
  const rest = value.startsWith("+998") ? value.slice(4) : value
  let digits = rest.replace(/\D/g, "")
  if (digits.length > 9 && digits.startsWith("998")) digits = digits.slice(3)
  digits = digits.slice(0, 9)

  const parts: string[] = []
  let at = 0
  for (const size of GROUPS) {
    if (at >= digits.length) break
    parts.push(digits.slice(at, at + size))
    at += size
  }
  return PREFIX + parts.join(" ")
}

// phoneDigits turns a complete masked number into 998901234567, the form the
// API takes; anything shorter is null.
export function phoneDigits(formatted: string): string | null {
  const digits = formatted.replace(/\D/g, "")
  return digits.length === 12 ? digits : null
}
