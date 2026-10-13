import type { Metadata } from "next"
import { CustomerPage } from "@/components/customers/customer-page"
import { PageTransition } from "@/components/kit/page-transition"

// What a tab and a screen reader call the page: the kind of page it is (the
// customer's own name is its heading).
export const metadata: Metadata = { title: "Mijoz — Hisob24" }

export default async function CustomerRoute({ params }: PageProps<"/customers/[id]">) {
  const { id } = await params
  return (
    <PageTransition>
      <CustomerPage id={Number(id)} />
    </PageTransition>
  )
}
