import type { Metadata } from "next"
import { StagesPage } from "@/components/settings/stages-page"

export const metadata: Metadata = { title: "Bosqichlar — Hisob24" }

// The stages the company's tasks go through; the page opens inside the app's shell.
export default function StagesRoute() {
  return <StagesPage />
}
