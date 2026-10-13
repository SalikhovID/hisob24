import type { Metadata } from "next"
import { InventoriesPage } from "@/components/warehouse/inventories-page"
import { PageTransition } from "@/components/kit/page-transition"

export const metadata: Metadata = { title: "Inventarizatsiya — Hisob24" }

// The counts of the current location; the page opens inside the app's shell.
export default function InventoriesRoute() {
  return (
    <PageTransition>
      <InventoriesPage />
    </PageTransition>
  )
}
