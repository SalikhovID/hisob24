import type { Metadata } from "next"
import { SalesPage } from "@/components/sales/sales-page"
import { PageTransition } from "@/components/kit/page-transition"

export const metadata: Metadata = { title: "Sotuvlar — Hisob24" }

// The sales of the current location; the page opens inside the app's shell.
export default function SalesRoute() {
  return (
    <PageTransition>
      <SalesPage />
    </PageTransition>
  )
}
