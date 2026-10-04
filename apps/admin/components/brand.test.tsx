import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { Brand } from "./brand"

test("Brand is Hisob24's logo and the word that tells the panel from the app", () => {
  render(<Brand />)

  expect(screen.getByRole("img", { name: "Hisob24" })).toBeInTheDocument()
  expect(screen.getByText("Admin")).toBeInTheDocument()
})
