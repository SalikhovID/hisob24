import type { Metadata } from "next"
import { TransferPage } from "@/components/warehouse/transfer-page"
import { PageTransition } from "@/components/kit/page-transition"

export const metadata: Metadata = { title: "Ko'chirish — Hisob24" }

export default async function TransferRoute({ params }: PageProps<"/transfers/[id]">) {
  const { id } = await params
  return (
    <PageTransition>
      <TransferPage id={Number(id)} />
    </PageTransition>
  )
}
