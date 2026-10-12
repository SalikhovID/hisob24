import type { Metadata } from "next"
import { ExpensesPage } from "@/components/finance/expenses-page"

export const metadata: Metadata = { title: "Xarajatlar — Hisob24" }

// The company's expenses and other income; the page opens inside the app's shell.
export default function ExpensesRoute() {
  return <ExpensesPage />
}
