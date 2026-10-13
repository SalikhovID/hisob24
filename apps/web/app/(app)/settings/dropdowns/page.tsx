import type { Metadata } from "next"
import { DropdownsPage } from "@/components/settings/dropdowns-page"
import { PageTransition } from "@/components/kit/page-transition"

export const metadata: Metadata = { title: "Dropdownlar — Hisob24" }

// The dropdowns the company's choice fields take their options from; the page opens inside the app's shell.
export default function DropdownsRoute() {
  return (
    <PageTransition>
      <DropdownsPage />
    </PageTransition>
  )
}
