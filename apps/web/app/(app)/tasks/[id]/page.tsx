import type { Metadata } from "next"
import { TaskPage } from "@/components/tasks/task-page"

// What a tab and a screen reader call the page: the kind of page it is (the
// task's own title is its heading).
export const metadata: Metadata = { title: "Vazifa — Hisob24" }

export default async function TaskRoute({ params }: PageProps<"/tasks/[id]">) {
  const { id } = await params
  return <TaskPage id={Number(id)} />
}
