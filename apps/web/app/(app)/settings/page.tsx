import type { Metadata } from "next"
import { SettingsPage } from "@/components/settings/settings-page"
import { PageTransition } from "@/components/kit/page-transition"

export const metadata: Metadata = { title: "Sozlamalar — Hisob24" }

// What the company's owner sets up for its customers; it opens inside the
// app's shell.
export default function SettingsRoute() {
  return (
    <PageTransition>
      <SettingsPage />
    </PageTransition>
  )
}
