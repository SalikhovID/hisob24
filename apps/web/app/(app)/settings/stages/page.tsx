import type { Metadata } from "next"
import { StagesPage } from "@/components/settings/stages-page"
import { PageTransition } from "@/components/kit/page-transition"

export const metadata: Metadata = { title: "Bosqichlar — Hisob24" }

// The stages the company's orders go through; the page opens inside the app's shell.
export default function StagesRoute() {
  return (
    <PageTransition>
      <StagesPage />
    </PageTransition>
  )
}
