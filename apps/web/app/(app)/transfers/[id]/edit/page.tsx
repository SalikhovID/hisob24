import type { Metadata } from "next"
import { EditTransferPage } from "@/components/warehouse/edit-transfer-page"
import { PageTransition } from "@/components/kit/page-transition"

export const metadata: Metadata = { title: "Ko'chirishni tahrirlash — Hisob24" }

export default async function EditTransferRoute({ params }: PageProps<"/transfers/[id]/edit">) {
  const { id } = await params
  return (
    <PageTransition>
      <EditTransferPage id={Number(id)} />
    </PageTransition>
  )
}
