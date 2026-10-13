import type { Metadata } from "next"
import { TypesPage } from "@/components/settings/types-page"
import { PageTransition } from "@/components/kit/page-transition"

export const metadata: Metadata = { title: "Vazifa turlari — Hisob24" }

// The company's task types with their fields; the page opens inside the app's shell.
export default function TaskTypesRoute() {
  return (
    <PageTransition>
      <TypesPage kind="task" />
    </PageTransition>
  )
}
