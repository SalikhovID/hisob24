import type { Metadata } from "next"
import { EditPurchasePage } from "@/components/warehouse/edit-purchase-page"
import { PageTransition } from "@/components/kit/page-transition"

export const metadata: Metadata = { title: "Xaridni tahrirlash — Hisob24" }

export default async function EditPurchaseRoute({ params }: PageProps<"/purchases/[id]/edit">) {
  const { id } = await params
  return (
    <PageTransition>
      <EditPurchasePage id={Number(id)} />
    </PageTransition>
  )
}
