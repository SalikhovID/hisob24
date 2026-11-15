import { formatAmount } from "./format"
import type { RateRounding, RateSourceCode } from "./types"

// RATE_SOURCES is where a company may take its rates (logic/currencies.md,
// section 4), as the select offers them: the central bank first, by hand
// last.
export const RATE_SOURCES: { value: RateSourceCode; label: string }[] = [
  { value: "cbu", label: "Markaziy bank" },
  { value: "kapitalbank", label: "Kapitalbank" },
  { value: "ipakyuli", label: "Ipak Yo'li banki" },
  { value: "asaka", label: "Asakabank" },
  { value: "hamkor", label: "Hamkorbank" },
  { value: "uzum", label: "Uzum Bank" },
  { value: "ofb", label: "Orient Finans Bank" },
  { value: "manual", label: "Qo'lda" },
]

// ROUNDINGS is the steps a bank's dollar and euro may be rounded to.
export const ROUNDINGS: RateRounding[] = [1, 10, 100, 1000]

// rateSourceName is the source by name: "Markaziy bank", "Qo'lda".
export function rateSourceName(source: RateSourceCode): string {
  return RATE_SOURCES.find((s) => s.value === source)?.label ?? source
}

// roundingName is a step as the select offers it: "100 so'm"; a step of 1
// keeps the bank's rate ("Yaxlitlanmaydi").
export function roundingName(step: RateRounding): string {
  return step === 1 ? "Yaxlitlanmaydi" : `${formatAmount(String(step))} so'm`
}

// roundingOf is how the company's rates are rounded, as its page tells it:
// the dollar and the euro to the step ("100 so'mgacha · USD, EUR"), nothing
// for a company that enters its rates by hand.
export function roundingOf(source: RateSourceCode, step: RateRounding): string {
  if (source === "manual") return "—"
  if (step === 1) return "Yaxlitlanmaydi"
  return `${formatAmount(String(step))} so'mgacha · USD, EUR`
}
