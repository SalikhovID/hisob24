import type { Metadata } from "next"
import { TabBarPage } from "@/components/settings/tab-bar-page"
import { PageTransition } from "@/components/kit/page-transition"

export const metadata: Metadata = { title: "Pastki panel — Hisob24" }

// The choice of the tab bar's pages, under the settings; every member's own.
export default function TabBarRoute() {
  return (
    <PageTransition>
      <TabBarPage />
    </PageTransition>
  )
}
