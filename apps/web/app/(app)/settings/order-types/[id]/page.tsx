import type { Metadata } from "next"
import { OrderTypePage } from "@/components/settings/order-type-page"
import { PageTransition } from "@/components/kit/page-transition"

// What a tab and a screen reader call the page: the kind of page it is (the
// type's own name is its heading).
export const metadata: Metadata = { title: "Buyurtma turi — Hisob24" }

export default async function OrderTypeRoute({ params }: PageProps<"/settings/order-types/[id]">) {
  const { id } = await params
  return (
    <PageTransition>
      <OrderTypePage id={Number(id)} />
    </PageTransition>
  )
}
