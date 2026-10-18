"use client"

import { TypePage } from "./type-page"

// OrderTypePage is one order type of the owner's company: the fields its form
// asks, in their order. The title, the deadline, the customer and the
// assignee are not among them: every order has those.
export function OrderTypePage({ id }: { id: number }) {
  return <TypePage kind="order" id={id} />
}
