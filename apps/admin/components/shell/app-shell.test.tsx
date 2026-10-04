import { screen, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { renderWithProviders } from "@/test/render"
import { AppShell } from "./app-shell"

test("the panel's sidebar is headed by the brand, over the sections", () => {
  renderWithProviders(
    <AppShell>
      <p>Sahifa mazmuni</p>
    </AppShell>,
  )

  const sidebar = screen.getByRole("complementary")
  const logo = within(sidebar).getByRole("img", { name: "Hisob24" })
  expect(within(sidebar).getByText("Admin")).toBeInTheDocument()
  const sections = within(sidebar).getByRole("link", { name: "Kompaniyalar" })
  expect(logo.compareDocumentPosition(sections) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})
