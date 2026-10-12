import type { Metadata } from "next"
import { EditSalePage } from "@/components/sales/edit-sale-page"

export const metadata: Metadata = { title: "Sotuvni tahrirlash — Hisob24" }

export default async function EditSaleRoute({ params }: PageProps<"/sales/[id]/edit">) {
  const { id } = await params
  return <EditSalePage id={Number(id)} />
}
