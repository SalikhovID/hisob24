import type { Metadata } from "next"
import { SupplierPage } from "@/components/warehouse/supplier-page"

// What a tab and a screen reader call the page: the kind of page it is (the
// supplier's own name is its heading).
export const metadata: Metadata = { title: "Ta'minotchi — Hisob24" }

export default async function SupplierRoute({ params }: PageProps<"/suppliers/[id]">) {
  const { id } = await params
  return <SupplierPage id={Number(id)} />
}
