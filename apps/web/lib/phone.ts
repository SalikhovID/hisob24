const GROUPS = [2, 3, 2, 2]

// formatPhoneInput shows what was typed in the phone field as 90 123 45 67.
// The field holds the number after +998, which sits beside it; a pasted or
// autofilled number with 998 in front loses it, and past nine digits the
// rest is dropped.
export function formatPhoneInput(value: string): string {
  let digits = value.replace(/\D/g, "")
  if (digits.length > 9 && digits.startsWith("998")) digits = digits.slice(3)
  digits = digits.slice(0, 9)

  const parts: string[] = []
  let at = 0
  for (const size of GROUPS) {
    if (at >= digits.length) break
    parts.push(digits.slice(at, at + size))
    at += size
  }
  return parts.join(" ")
}

// phoneDigits turns a complete field into 998901234567, the form the API
// takes; anything shorter is null.
export function phoneDigits(field: string): string | null {
  const digits = field.replace(/\D/g, "")
  return digits.length === 9 ? `998${digits}` : null
}

// formatPhone writes a phone the API keeps (998901234567) for people to read.
export function formatPhone(digits: string): string {
  return `+998 ${formatPhoneInput(digits)}`
}
