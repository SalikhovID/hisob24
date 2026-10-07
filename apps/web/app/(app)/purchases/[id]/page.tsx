import type { Metadata } from "next"
import { PurchasePage } from "@/components/warehouse/purchase-page"

// What a tab and a screen reader call the page: the kind of page it is (the
// purchase's number is its heading).
export const metadata: Metadata = { title: "Xarid — Hisob24" }

export default async function PurchaseRoute({ params }: PageProps<"/purchases/[id]">) {
  const { id } = await params
  return <PurchasePage id={Number(id)} />
}
