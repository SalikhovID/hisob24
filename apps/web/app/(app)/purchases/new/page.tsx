import type { Metadata } from "next"
import { NewPurchasePage } from "@/components/warehouse/new-purchase-page"

export const metadata: Metadata = { title: "Yangi xarid — Hisob24" }

// A purchase into the current location; the page opens inside the app's shell.
export default function NewPurchaseRoute() {
  return <NewPurchasePage />
}
