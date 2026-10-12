import type { Metadata } from "next"
import { NewTransferPage } from "@/components/warehouse/new-transfer-page"

export const metadata: Metadata = { title: "Yangi ko'chirish — Hisob24" }

export default function NewTransferRoute() {
  return <NewTransferPage />
}
