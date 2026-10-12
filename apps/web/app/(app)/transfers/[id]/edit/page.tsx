import type { Metadata } from "next"
import { EditTransferPage } from "@/components/warehouse/edit-transfer-page"

export const metadata: Metadata = { title: "Ko'chirishni tahrirlash — Hisob24" }

export default async function EditTransferRoute({ params }: PageProps<"/transfers/[id]/edit">) {
  const { id } = await params
  return <EditTransferPage id={Number(id)} />
}
