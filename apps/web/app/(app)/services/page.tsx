import type { Metadata } from "next"
import { Suspense } from "react"
import { CatalogPage } from "@/components/catalog/catalog-page"

export const metadata: Metadata = { title: "Xizmatlar — Hisob24" }

// The company's services, for whoever may see the products; the page opens
// inside the app's shell and reads its filter from the address.
export default function ServicesRoute() {
  return (
    <Suspense>
      <CatalogPage kind="service" />
    </Suspense>
  )
}
