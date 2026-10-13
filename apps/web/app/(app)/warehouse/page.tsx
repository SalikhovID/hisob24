import type { Metadata } from "next"
import { WarehouseHub } from "@/components/warehouse/warehouse-hub"

export const metadata: Metadata = { title: "Ombor — Hisob24" }

// The warehouse opens at its hub: the list of its pages.
export default function WarehouseRoute() {
  return <WarehouseHub />
}
