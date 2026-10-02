import { screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { setLocation } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { NavLinks } from "./nav-links"

test("NavLinks lead to the panel's sections and mark the current one", () => {
  setLocation("/companies/5")

  renderWithProviders(<NavLinks />)

  const companies = screen.getByRole("link", { name: "Kompaniyalar" })
  expect(companies).toHaveAttribute("href", "/companies")
  expect(companies).toHaveAttribute("aria-current", "page")
  const admins = screen.getByRole("link", { name: "Adminlar" })
  expect(admins).toHaveAttribute("href", "/admins")
  expect(admins).not.toHaveAttribute("aria-current")
})
