import type { Metadata } from "next"
import { InventoryPage } from "@/components/warehouse/inventory-page"

export const metadata: Metadata = { title: "Inventarizatsiya — Hisob24" }

export default async function InventoryRoute({ params }: PageProps<"/inventories/[id]">) {
  const { id } = await params
  return <InventoryPage id={Number(id)} />
}
