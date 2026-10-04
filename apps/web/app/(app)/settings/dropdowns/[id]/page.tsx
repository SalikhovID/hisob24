import type { Metadata } from "next"
import { DropdownPage } from "@/components/settings/dropdown-page"

// What a tab and a screen reader call the page: the kind of page it is (the
// dropdown's own name is its heading).
export const metadata: Metadata = { title: "Dropdown — Hisob24" }

export default async function DropdownRoute({ params }: PageProps<"/settings/dropdowns/[id]">) {
  const { id } = await params
  return <DropdownPage id={Number(id)} />
}
