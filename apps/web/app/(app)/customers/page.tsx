import type { Metadata } from "next"
import { Suspense } from "react"
import { CustomersPage } from "@/components/customers/customers-page"

export const metadata: Metadata = { title: "Mijozlar — Hisob24" }

// The company's customers, for every member of it; the page opens inside the
// app's shell. It reads its filter from the address (useSearchParams), which
// needs a Suspense boundary.
export default function CustomersRoute() {
  return (
    <Suspense>
      <CustomersPage />
    </Suspense>
  )
}
