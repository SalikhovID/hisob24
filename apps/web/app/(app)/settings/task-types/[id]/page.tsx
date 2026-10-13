import type { Metadata } from "next"
import { TaskTypePage } from "@/components/settings/task-type-page"
import { PageTransition } from "@/components/kit/page-transition"

// What a tab and a screen reader call the page: the kind of page it is (the
// type's own name is its heading).
export const metadata: Metadata = { title: "Vazifa turi — Hisob24" }

export default async function TaskTypeRoute({ params }: PageProps<"/settings/task-types/[id]">) {
  const { id } = await params
  return (
    <PageTransition>
      <TaskTypePage id={Number(id)} />
    </PageTransition>
  )
}
