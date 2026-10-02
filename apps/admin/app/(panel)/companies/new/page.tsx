import { ArrowLeftIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { NewCompanyForm } from "@/components/companies/new-company-form"

export const metadata: Metadata = { title: "Yangi kompaniya — Hisob24 Admin" }

export default function Page() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/companies" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="size-4" />
          Kompaniyalar
        </Link>
        <h1 className="text-xl font-semibold">Yangi kompaniya</h1>
      </div>
      <NewCompanyForm />
    </div>
  )
}
