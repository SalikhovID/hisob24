import type { Metadata } from "next"
import { CompaniesPage } from "@/components/companies/companies-page"

export const metadata: Metadata = { title: "Kompaniyalar — Hisob24 Admin" }

export default function Page() {
  return <CompaniesPage />
}
