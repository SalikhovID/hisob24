import type { Metadata } from "next"
import { Suspense } from "react"
import { SuppliersPage } from "@/components/warehouse/suppliers-page"

export const metadata: Metadata = { title: "Ta'minotchilar — Hisob24" }

// The company's suppliers, for whoever may see them; the page opens inside
// the app's shell and reads its filter from the address (useSearchParams),
// which needs a Suspense boundary.
export default function SuppliersRoute() {
  return (
    <Suspense>
      <SuppliersPage />
    </Suspense>
  )
}
