import { screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { expect, test } from "vitest"
import { ALI, db, typesOf, VALI } from "@/mocks/data"
import { router } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { server } from "@/test/server"
import { chooseCompany, signIn } from "@/test/session"
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

test("a choice field says which dropdown it takes its options from", async () => {
  await signIn(ALI)
  const [jismoniy] = typesOf(1)
  renderWithProviders(<CustomerTypePage id={jismoniy.id} />)

  await waitFor(async () =>
    expect(fieldsOf(await fieldList())).toEqual([
      { label: "F.I.Sh.", kind: "Matn", marks: ["Mijoz nomi", "Majburiy"] },
      { label: "Manba", kind: "Dropdown (bitta tanlov) · Manba", marks: [] },
    ]),
  )
})

test("a type that is not there says so and leads back", async () => {
  await signIn(ALI)
  renderWithProviders(<CustomerTypePage id={999} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Tur topilmadi" })).toBeInTheDocument()
  expect(screen.getByText("Bu tur o'chirilgan yoki sizning kompaniyangizniki emas.")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Sozlamalar" })).toHaveAttribute("href", "/settings")
  expect(screen.queryByRole("list", { name: "Maydonlar" })).not.toBeInTheDocument()
})

test("a type with no fields says what that means", async () => {
  await signIn(ALI)
  const [jismoniy] = typesOf(1)
  db.types.find((type) => type.id === jismoniy.id)!.fields = []
  renderWithProviders(<CustomerTypePage id={jismoniy.id} />)

  expect(await screen.findByText("Bu turda maydon yo'q")).toBeInTheDocument()
  expect(screen.getByText("Mijoz faqat telefon raqami bilan qo'shiladi.")).toBeInTheDocument()
  expect(screen.getByText("Mijoz turi · 0 ta maydon")).toBeInTheDocument()
})

test("the type's page says why it failed to load and can be asked for again", async () => {
  await signIn(ALI)
  const [jismoniy] = typesOf(1)
  server.use(http.get("*/api/app/customer-types", () => HttpResponse.error(), { once: true }))
  const { user } = renderWithProviders(<CustomerTypePage id={jismoniy.id} />)

  expect(await screen.findByText("Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring")).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Qayta urinish" }))

  expect(await screen.findByRole("heading", { level: 1, name: "Jismoniy" })).toBeInTheDocument()
})

test("an employee is sent home: a type's page is the owner's", async () => {
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<CustomerTypePage id={typesOf(1)[0].id} />)

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"))
  expect(screen.queryByRole("heading")).not.toBeInTheDocument()
})
