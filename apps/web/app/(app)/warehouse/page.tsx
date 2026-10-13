import type { Metadata } from "next"
import { WarehouseHub } from "@/components/warehouse/warehouse-hub"
import { PageTransition } from "@/components/kit/page-transition"

export const metadata: Metadata = { title: "Ombor — Hisob24" }

// The warehouse opens at its hub: the list of its pages.
export default function WarehouseRoute() {
  return (
    <PageTransition>
      <WarehouseHub />
    </PageTransition>
  )
}
