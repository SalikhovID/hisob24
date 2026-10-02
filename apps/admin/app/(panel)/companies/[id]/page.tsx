import { CompanyPage } from "@/components/companies/company-page"

export default async function Page({ params }: PageProps<"/companies/[id]">) {
  const { id } = await params
  return <CompanyPage id={Number(id)} />
}
