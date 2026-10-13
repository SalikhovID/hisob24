import type { Metadata } from "next"
import { SupplierPage } from "@/components/warehouse/supplier-page"
import { PageTransition } from "@/components/kit/page-transition"

// What a tab and a screen reader call the page: the kind of page it is (the
// supplier's own name is its heading).
export const metadata: Metadata = { title: "Ta'minotchi — Hisob24" }

export default async function SupplierRoute({ params }: PageProps<"/suppliers/[id]">) {
  const { id } = await params
  return (
    <PageTransition>
      <SupplierPage id={Number(id)} />
    </PageTransition>
  )
}
