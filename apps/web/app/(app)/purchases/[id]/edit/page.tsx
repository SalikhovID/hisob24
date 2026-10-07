import type { Metadata } from "next"
import { EditPurchasePage } from "@/components/warehouse/edit-purchase-page"

export const metadata: Metadata = { title: "Xaridni tahrirlash — Hisob24" }

export default async function EditPurchaseRoute({ params }: PageProps<"/purchases/[id]/edit">) {
  const { id } = await params
  return <EditPurchasePage id={Number(id)} />
}
