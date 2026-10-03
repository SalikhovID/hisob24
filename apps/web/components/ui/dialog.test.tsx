import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { Dialog, DialogContent, DialogTitle } from "./dialog"

// The interface speaks Uzbek, to screen readers too.
test("an open dialog's close button is named in Uzbek", async () => {
  render(
    <Dialog open>
      <DialogContent>
        <DialogTitle>Sarlavha</DialogTitle>
      </DialogContent>
    </Dialog>,
  )

  expect(await screen.findByRole("button", { name: "Yopish" })).toBeInTheDocument()
})
