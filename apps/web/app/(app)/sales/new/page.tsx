import type { Metadata } from "next"
import { NewSalePage } from "@/components/sales/new-sale-page"

export const metadata: Metadata = { title: "Yangi sotuv — Hisob24" }

export default function NewSaleRoute() {
  return <NewSalePage />
}
