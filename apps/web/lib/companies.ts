import type { AppCompany } from "./types"

// unavailable says why a company cannot be worked in: the API would answer
// 402 for it. null when it can.
export function unavailable(company: AppCompany): { label: string; expired: boolean } | null {
  if (!company.is_active) return { label: "Bloklangan", expired: false }
  if (company.days_left < 0) return { label: "Muddati o'tgan", expired: true }
  return null
}
