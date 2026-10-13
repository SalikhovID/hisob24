import type { Metadata } from "next"
import { ExpensesPage } from "@/components/finance/expenses-page"
import { PageTransition } from "@/components/kit/page-transition"

export const metadata: Metadata = { title: "Xarajatlar — Hisob24" }

// The company's expenses and other income; the page opens inside the app's shell.
export default function ExpensesRoute() {
  return (
    <PageTransition>
      <ExpensesPage />
    </PageTransition>
  )
}
