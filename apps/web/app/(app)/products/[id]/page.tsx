import type { Metadata } from "next"
import { ProductPage } from "@/components/catalog/product-page"

// What a tab and a screen reader call the page: the kind of page it is (the
// product's own name is its heading).
export const metadata: Metadata = { title: "Mahsulot — Hisob24" }

export default async function ProductRoute({ params }: PageProps<"/products/[id]">) {
  const { id } = await params
  return <ProductPage id={Number(id)} />
}
