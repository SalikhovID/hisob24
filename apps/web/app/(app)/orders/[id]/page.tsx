import type { Metadata } from "next"
import { OrderPage } from "@/components/orders/order-page"
import { PageTransition } from "@/components/kit/page-transition"

// What a tab and a screen reader call the page: the kind of page it is (the
// order's own title is its heading).
export const metadata: Metadata = { title: "Vazifa — Hisob24" }

export default async function OrderRoute({ params }: PageProps<"/orders/[id]">) {
  const { id } = await params
  return (
    <PageTransition>
      <OrderPage id={Number(id)} />
    </PageTransition>
  )
}
