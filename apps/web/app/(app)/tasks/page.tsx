import type { Metadata } from "next"
import { Suspense } from "react"
import { TasksPage } from "@/components/tasks/tasks-page"

export const metadata: Metadata = { title: "Vazifalar — Hisob24" }

// The company's tasks, for every member of it; the page opens inside the
// app's shell. It reads its view and filter from the address
// (useSearchParams), which needs a Suspense boundary.
export default function TasksRoute() {
  return (
    <Suspense>
      <TasksPage />
    </Suspense>
  )
}
