import type { Metadata } from "next"
import { ProductCategoriesPage } from "@/components/settings/product-categories-page"
import { PageTransition } from "@/components/kit/page-transition"

export const metadata: Metadata = { title: "Mahsulot kategoriyalari — Hisob24" }

// The categories the company's products are filed under; the page opens inside the app's shell.
export default function ProductCategoriesRoute() {
  return (
    <PageTransition>
      <ProductCategoriesPage />
    </PageTransition>
  )
}
