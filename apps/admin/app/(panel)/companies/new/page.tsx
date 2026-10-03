import type { Metadata } from "next"
import { NewCompanyForm } from "@/components/companies/new-company-form"
import { PageHeader } from "@/components/page-header"

export const metadata: Metadata = { title: "Yangi kompaniya — Hisob24 Admin" }

export default function Page() {
  return (
    <div className="space-y-5">
      <PageHeader back={{ href: "/companies", label: "Kompaniyalar" }} title="Yangi kompaniya" />
      <NewCompanyForm />
    </div>
  )
}
