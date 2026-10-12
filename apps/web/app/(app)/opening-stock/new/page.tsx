import type { Metadata } from "next"
import { NewOpeningStockPage } from "@/components/warehouse/new-opening-stock-page"

export const metadata: Metadata = { title: "Yangi boshlang'ich qoldiq — Hisob24" }

export default function NewOpeningStockRoute() {
  return <NewOpeningStockPage />
}
