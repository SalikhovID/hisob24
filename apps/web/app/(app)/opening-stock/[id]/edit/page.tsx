import type { Metadata } from "next"
import { EditOpeningStockPage } from "@/components/warehouse/edit-opening-stock-page"
import { PageTransition } from "@/components/kit/page-transition"

export const metadata: Metadata = { title: "Boshlang'ich qoldiqni tahrirlash — Hisob24" }

export default async function EditOpeningStockRoute({ params }: PageProps<"/opening-stock/[id]/edit">) {
  const { id } = await params
  return (
    <PageTransition>
      <EditOpeningStockPage id={Number(id)} />
    </PageTransition>
  )
}
