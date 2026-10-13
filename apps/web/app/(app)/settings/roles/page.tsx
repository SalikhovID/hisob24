import type { Metadata } from "next"
import { RolesPage } from "@/components/settings/roles-page"
import { PageTransition } from "@/components/kit/page-transition"

export const metadata: Metadata = { title: "Rollar — Hisob24" }

// The company's roles, the owner's alone; the page opens inside the app's shell.
export default function RolesRoute() {
  return (
    <PageTransition>
      <RolesPage />
    </PageTransition>
  )
}
