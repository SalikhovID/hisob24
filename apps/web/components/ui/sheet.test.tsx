import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { Sheet, SheetContent, SheetTitle } from "./sheet"

// The interface speaks Uzbek, to screen readers too.
test("an open sheet's close button is named in Uzbek", async () => {
  render(
    <Sheet open>
      <SheetContent>
        <SheetTitle>Menyu</SheetTitle>
      </SheetContent>
    </Sheet>,
  )

  expect(await screen.findByRole("button", { name: "Yopish" })).toBeInTheDocument()
})
