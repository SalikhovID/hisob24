import type { Metadata } from "next"
import { TransfersPage } from "@/components/warehouse/transfers-page"

export const metadata: Metadata = { title: "Ko'chirishlar — Hisob24" }

// The transfers of the current location; the page opens inside the app's shell.
export default function TransfersRoute() {
  return <TransfersPage />
}
