import { screen, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, typesOf } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import { CustomerTypePage } from "./customer-type-page"

const fieldList = () => screen.findByRole("list", { name: "Maydonlar" })

// fieldsOf reads the list as each field's name, kind and marks.
const fieldsOf = (list: HTMLElement) =>
  within(list)
    .getAllByRole("listitem")
    .map((row) => ({
      label: row.querySelector('[data-slot="setting-title"]')?.textContent,
      kind: row.querySelector('[data-slot="setting-detail"]')?.textContent,
      marks: Array.from(row.querySelectorAll('[data-slot="badge"]')).map((mark) => mark.textContent),
    }))

test("the owner sees the type's fields: what each asks, of what kind, with its marks", async () => {
  await signIn(ALI)
  const [, yuridik] = typesOf(1)
  renderWithProviders(<CustomerTypePage id={yuridik.id} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Yuridik" })).toBeInTheDocument()
  expect(screen.getByText("Mijoz turi · 2 ta maydon")).toBeInTheDocument()
  expect(fieldsOf(await fieldList())).toEqual([
    { label: "Nomi", kind: "Matn", marks: ["Mijoz nomi", "Majburiy"] },
    { label: "INN", kind: "Butun son", marks: ["Majburiy", "Takrorlanmas"] },
  ])
  expect(screen.getByRole("link", { name: "Sozlamalar" })).toHaveAttribute("href", "/settings")
  expect(screen.getByText(/Telefon har doim bor va majburiy/)).toBeInTheDocument()
})
