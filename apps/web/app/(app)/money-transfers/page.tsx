import type { Metadata } from "next"
import { MoneyTransfersPage } from "@/components/finance/money-transfers-page"
import { PageTransition } from "@/components/kit/page-transition"

export const metadata: Metadata = { title: "O'tkazmalar — Hisob24" }

// The transfers between accounts and the conversions; the page opens inside the app's shell.
export default function MoneyTransfersRoute() {
  return (
    <PageTransition>
      <MoneyTransfersPage />
    </PageTransition>
  )
}
