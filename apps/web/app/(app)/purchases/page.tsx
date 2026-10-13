import type { Metadata } from "next"
import { Suspense } from "react"
import { PurchasesPage } from "@/components/warehouse/purchases-page"
import { PageTransition } from "@/components/kit/page-transition"

export const metadata: Metadata = { title: "Xaridlar — Hisob24" }

// The purchases of the current location; the page opens inside the app's
// shell and reads its page number from the address (useSearchParams), which
// needs a Suspense boundary.
export default function PurchasesRoute() {
  return (
    <PageTransition>
      <Suspense>
        <PurchasesPage />
      </Suspense>
    </PageTransition>
  )
}
