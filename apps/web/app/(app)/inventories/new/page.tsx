import type { Metadata } from "next"
import { NewInventoryPage } from "@/components/warehouse/new-inventory-page"
import { PageTransition } from "@/components/kit/page-transition"

export const metadata: Metadata = { title: "Yangi inventarizatsiya — Hisob24" }

export default function NewInventoryRoute() {
  return (
    <PageTransition>
      <NewInventoryPage />
    </PageTransition>
  )
}
