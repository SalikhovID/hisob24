import type { Metadata } from "next"
import { CustomerPage } from "@/components/customers/customer-page"

// What a tab and a screen reader call the page: the kind of page it is (the
// customer's own name is its heading).
export const metadata: Metadata = { title: "Mijoz — Hisob24" }

export default async function CustomerRoute({ params }: PageProps<"/customers/[id]">) {
  const { id } = await params
  return <CustomerPage id={Number(id)} />
}
