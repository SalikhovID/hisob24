import type { Metadata } from "next"
import { TaskTypePage } from "@/components/settings/task-type-page"

// What a tab and a screen reader call the page: the kind of page it is (the
// type's own name is its heading).
export const metadata: Metadata = { title: "Vazifa turi — Hisob24" }

export default async function TaskTypeRoute({ params }: PageProps<"/settings/task-types/[id]">) {
  const { id } = await params
  return <TaskTypePage id={Number(id)} />
}
