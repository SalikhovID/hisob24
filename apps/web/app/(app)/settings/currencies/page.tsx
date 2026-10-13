import type { Metadata } from "next"
import { CurrencyRatesPage } from "@/components/settings/currency-rates-page"

export const metadata: Metadata = { title: "Valyuta kurslari — Hisob24" }

// The company's currency rates and their history; the page opens inside the app's shell.
export default function CurrencyRatesRoute() {
  return <CurrencyRatesPage />
}
