import type { Metadata } from "next"
import { SalePage } from "@/components/sales/sale-page"

export const metadata: Metadata = { title: "Sotuv — Hisob24" }

export default async function SaleRoute({ params }: PageProps<"/sales/[id]">) {
  const { id } = await params
  return <SalePage id={Number(id)} />
}
