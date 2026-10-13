import type { Metadata } from "next"
import { EditInventoryPage } from "@/components/warehouse/edit-inventory-page"
import { PageTransition } from "@/components/kit/page-transition"

export const metadata: Metadata = { title: "Inventarizatsiyani tahrirlash — Hisob24" }

export default async function EditInventoryRoute({ params }: PageProps<"/inventories/[id]/edit">) {
  const { id } = await params
  return (
    <PageTransition>
      <EditInventoryPage id={Number(id)} />
    </PageTransition>
  )
}
