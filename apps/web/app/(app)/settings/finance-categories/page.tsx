import type { Metadata } from "next"
import { FinanceCategoriesPage } from "@/components/settings/finance-categories-page"
import { PageTransition } from "@/components/kit/page-transition"

export const metadata: Metadata = { title: "Moliya kategoriyalari — Hisob24" }

// The categories the company's expenses and other income are filed under; the page opens inside the app's shell.
export default function FinanceCategoriesRoute() {
  return (
    <PageTransition>
      <FinanceCategoriesPage />
    </PageTransition>
  )
}
