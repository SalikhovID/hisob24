import type { Metadata } from "next"
import { CompanyPage } from "@/components/companies/company-page"

// What a tab, the history and a screen reader call the page: the kind of
// page it is (the company's own name is its heading).
export const metadata: Metadata = { title: "Kompaniya — Hisob24 Admin" }

export default async function Page({ params }: PageProps<"/companies/[id]">) {
  const { id } = await params
  return <CompanyPage id={Number(id)} />
}
