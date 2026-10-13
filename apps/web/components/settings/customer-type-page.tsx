"use client"

import { TypePage } from "./type-page"

// CustomerTypePage is one customer type of the owner's company: the fields
// its form asks, in their order. The phone is not among them: every
// customer has one. The first text field is the name a customer goes by.
export function CustomerTypePage({ id }: { id: number }) {
  return <TypePage kind="customer" id={id} />
}
