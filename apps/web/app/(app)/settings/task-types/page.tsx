import type { Metadata } from "next"
import { TypesPage } from "@/components/settings/types-page"
import { PageTransition } from "@/components/kit/page-transition"

export const metadata: Metadata = { title: "Vazifa turlari — Hisob24" }

// The company's order types with their fields; the page opens inside the app's shell.
export default function OrderTypesRoute() {
  return (
    <PageTransition>
      <TypesPage kind="order" />
    </PageTransition>
  )
}
