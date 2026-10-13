import type { Metadata } from "next"
import { TypesPage } from "@/components/settings/types-page"
import { PageTransition } from "@/components/kit/page-transition"

export const metadata: Metadata = { title: "Mijoz turlari — Hisob24" }

// The company's customer types with their fields; the page opens inside the app's shell.
export default function CustomerTypesRoute() {
  return (
    <PageTransition>
      <TypesPage kind="customer" />
    </PageTransition>
  )
}
