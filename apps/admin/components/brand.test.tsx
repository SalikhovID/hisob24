import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { Brand } from "./brand"

test("Brand is Hisob24's logo and the word that tells the panel from the app", () => {
  render(<Brand />)

  expect(screen.getByRole("img", { name: "Hisob24" })).toBeInTheDocument()
  expect(screen.getByText("Admin")).toBeInTheDocument()
})

test("a heading that holds the Brand is named by both words, a space between them", () => {
  render(
    <h1>
      <Brand />
    </h1>,
  )

  expect(screen.getByRole("heading", { level: 1, name: "Hisob24 Admin" })).toBeInTheDocument()
})
