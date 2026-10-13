import type { Metadata } from "next"
import { NewSalePage } from "@/components/sales/new-sale-page"
import { PageTransition } from "@/components/kit/page-transition"

export const metadata: Metadata = { title: "Yangi sotuv — Hisob24" }

export default function NewSaleRoute() {
  return (
    <PageTransition>
      <NewSalePage />
    </PageTransition>
  )
}
