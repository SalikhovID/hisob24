import type { Metadata } from "next"
import { Suspense } from "react"
import { OrdersPage } from "@/components/orders/orders-page"
import { PageTransition } from "@/components/kit/page-transition"

export const metadata: Metadata = { title: "Buyurtmalar — Hisob24" }

// The company's orders, for every member of it; the page opens inside the
// app's shell. It reads its view and filter from the address
// (useSearchParams), which needs a Suspense boundary.
export default function OrdersRoute() {
  return (
    <PageTransition>
      <Suspense>
        <OrdersPage />
      </Suspense>
    </PageTransition>
  )
}
