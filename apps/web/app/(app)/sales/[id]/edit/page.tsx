import type { Metadata } from "next"
import { EditSalePage } from "@/components/sales/edit-sale-page"
import { PageTransition } from "@/components/kit/page-transition"

export const metadata: Metadata = { title: "Sotuvni tahrirlash — Hisob24" }

export default async function EditSaleRoute({ params }: PageProps<"/sales/[id]/edit">) {
  const { id } = await params
  return (
    <PageTransition>
      <EditSalePage id={Number(id)} />
    </PageTransition>
  )
}
