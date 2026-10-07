import type { Metadata } from "next"
import { Suspense } from "react"
import { CatalogPage } from "@/components/catalog/catalog-page"

export const metadata: Metadata = { title: "Mahsulotlar — Hisob24" }

// The company's products, for whoever may see them; the page opens inside
// the app's shell. It reads its filter from the address (useSearchParams),
// which needs a Suspense boundary.
export default function ProductsRoute() {
  return (
    <Suspense>
      <CatalogPage kind="product" />
    </Suspense>
  )
}
