import type { Metadata } from "next"
import { EditInventoryPage } from "@/components/warehouse/edit-inventory-page"

export const metadata: Metadata = { title: "Inventarizatsiyani tahrirlash — Hisob24" }

export default async function EditInventoryRoute({ params }: PageProps<"/inventories/[id]/edit">) {
  const { id } = await params
  return <EditInventoryPage id={Number(id)} />
}
