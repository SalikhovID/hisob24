import type { Metadata } from "next"
import { InventoryPage } from "@/components/warehouse/inventory-page"
import { PageTransition } from "@/components/kit/page-transition"

export const metadata: Metadata = { title: "Inventarizatsiya — Hisob24" }

export default async function InventoryRoute({ params }: PageProps<"/inventories/[id]">) {
  const { id } = await params
  return (
    <PageTransition>
      <InventoryPage id={Number(id)} />
    </PageTransition>
  )
}
