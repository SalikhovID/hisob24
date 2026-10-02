import type { Metadata } from "next"
import { SelectCompany } from "@/components/select-company"

export const metadata: Metadata = { title: "Kompaniyani tanlash — Hisob24" }

export default function SelectCompanyPage() {
  return <SelectCompany />
}
