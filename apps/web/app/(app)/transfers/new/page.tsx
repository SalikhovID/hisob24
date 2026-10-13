import type { Metadata } from "next"
import { NewTransferPage } from "@/components/warehouse/new-transfer-page"
import { PageTransition } from "@/components/kit/page-transition"

export const metadata: Metadata = { title: "Yangi ko'chirish — Hisob24" }

export default function NewTransferRoute() {
  return (
    <PageTransition>
      <NewTransferPage />
    </PageTransition>
  )
}
