import type { Metadata } from "next"
import { OpeningStockDetailPage } from "@/components/warehouse/opening-stock-detail-page"
import { PageTransition } from "@/components/kit/page-transition"

export const metadata: Metadata = { title: "Boshlang'ich qoldiq — Hisob24" }

export default async function OpeningStockDetailRoute({ params }: PageProps<"/opening-stock/[id]">) {
  const { id } = await params
  return (
    <PageTransition>
      <OpeningStockDetailPage id={Number(id)} />
    </PageTransition>
  )
}
