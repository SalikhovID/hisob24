import type { Metadata } from "next"
import { CustomerTypePage } from "@/components/settings/customer-type-page"

// What a tab and a screen reader call the page: the kind of page it is (the
// type's own name is its heading).
export const metadata: Metadata = { title: "Mijoz turi — Hisob24" }

export default async function CustomerTypeRoute({ params }: PageProps<"/settings/customer-types/[id]">) {
  const { id } = await params
  return <CustomerTypePage id={Number(id)} />
}
