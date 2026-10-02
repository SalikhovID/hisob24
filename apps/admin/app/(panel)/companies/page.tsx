import type { Metadata } from "next"
import { Suspense } from "react"
import { CompaniesPage } from "@/components/companies/companies-page"

export const metadata: Metadata = { title: "Kompaniyalar — Hisob24 Admin" }

// The page reads its filter from the address (useSearchParams), which needs
// a Suspense boundary.
export default function Page() {
  return (
    <Suspense>
      <CompaniesPage />
    </Suspense>
  )
}
