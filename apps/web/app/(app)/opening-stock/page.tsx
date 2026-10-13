import type { Metadata } from "next"
import { OpeningStockPage } from "@/components/warehouse/opening-stock-page"
import { PageTransition } from "@/components/kit/page-transition"

export const metadata: Metadata = { title: "Boshlang'ich qoldiq — Hisob24" }

// The opening stock of the current location; the page opens inside the app's shell.
export default function OpeningStockRoute() {
  return (
    <PageTransition>
      <OpeningStockPage />
    </PageTransition>
  )
}
