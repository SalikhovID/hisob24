import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"
import Home from "./page"

test("bosh sahifa ilova nomini ko'rsatadi", () => {
  render(<Home />)

  expect(screen.getByRole("heading", { name: "Hisob24" })).toBeInTheDocument()
})
