"use client"

import { TypePage } from "./type-page"

// TaskTypePage is one task type of the owner's company: the fields its form
// asks, in their order. The title, the deadline, the customer and the
// assignee are not among them: every task has those.
export function TaskTypePage({ id }: { id: number }) {
  return <TypePage kind="task" id={id} />
}
