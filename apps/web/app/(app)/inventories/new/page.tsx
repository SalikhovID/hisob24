import type { Metadata } from "next"
import { NewInventoryPage } from "@/components/warehouse/new-inventory-page"

export const metadata: Metadata = { title: "Yangi inventarizatsiya — Hisob24" }

export default function NewInventoryRoute() {
  return <NewInventoryPage />
}
