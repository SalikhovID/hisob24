import { fireEvent, screen, waitFor } from "@testing-library/react"
import { delay, http, HttpResponse } from "msw"
import { expect, test } from "vitest"
import { company } from "@/mocks/data"
import { router } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { server } from "@/test/server"
import { NewCompanyForm } from "./new-company-form"

test("the new company form says what is missing", async () => {
  const { user } = renderWithProviders(<NewCompanyForm />)

  await user.click(screen.getByRole("button", { name: "Yaratish" }))

  expect(await screen.findByText("Kompaniya nomini kiriting")).toBeInTheDocument()
  expect(screen.getByText("Tugash sanasini tanlang")).toBeInTheDocument()
  expect(screen.getByText("Egasining telefon raqami noto'g'ri")).toBeInTheDocument()
  expect(screen.getByText("Egasining ismini kiriting")).toBeInTheDocument()
  expect(screen.getByLabelText("Kompaniya nomi")).toHaveAttribute("aria-invalid", "true")
})

test("a complete form creates the company and opens it", async () => {
  let sent: unknown
  server.use(
    http.post("*/api/admin/companies", async ({ request }) => {
      sent = await request.json()
      return HttpResponse.json(company(4, "Behi Savdo", "2026-12-31"), { status: 201 })
    }),
  )
  const { user } = renderWithProviders(<NewCompanyForm />)

  await user.type(screen.getByLabelText("Kompaniya nomi"), " Behi Savdo ")
  fireEvent.change(screen.getByLabelText("Tugash sanasi"), { target: { value: "2026-12-31" } })
  await user.type(screen.getByLabelText("Egasining telefoni"), "90 123 45 67")
  await user.type(screen.getByLabelText("Egasining ismi"), "Ali Valiyev")
  await user.click(screen.getByRole("button", { name: "Yaratish" }))

  await waitFor(() => expect(router.push).toHaveBeenCalledWith("/companies/4"))
  expect(sent).toEqual({
    name: "Behi Savdo",
    end_date: "2026-12-31",
    owner_phone: "998901234567",
    owner_full_name: "Ali Valiyev",
  })
  expect(await screen.findByText("Kompaniya yaratildi")).toBeInTheDocument()
})

test("when the API refuses, the form shows its message and stays", async () => {
  server.use(
    http.post("*/api/admin/companies", () =>
      HttpResponse.json(
        { error: "validation_error", message: "Tugash sanasi YYYY-MM-DD ko'rinishida bo'lishi kerak" },
        { status: 400 },
      ),
    ),
  )
  const { user } = renderWithProviders(<NewCompanyForm />)

  await user.type(screen.getByLabelText("Kompaniya nomi"), "Behi Savdo")
  fireEvent.change(screen.getByLabelText("Tugash sanasi"), { target: { value: "2026-12-31" } })
  await user.type(screen.getByLabelText("Egasining telefoni"), "901234567")
  await user.type(screen.getByLabelText("Egasining ismi"), "Ali")
  await user.click(screen.getByRole("button", { name: "Yaratish" }))

  expect(await screen.findByText("Tugash sanasi YYYY-MM-DD ko'rinishida bo'lishi kerak")).toBeInTheDocument()
  expect(router.push).not.toHaveBeenCalled()
})

test("while the company is on its way the form's button says so", async () => {
  server.use(
    http.post("*/api/admin/companies", async () => {
      await delay("infinite")
      return new HttpResponse(null)
    }),
  )
  const { user } = renderWithProviders(<NewCompanyForm />)

  await user.type(screen.getByLabelText("Kompaniya nomi"), "Behi Savdo")
  fireEvent.change(screen.getByLabelText("Tugash sanasi"), { target: { value: "2026-12-31" } })
  await user.type(screen.getByLabelText("Egasining telefoni"), "901234567")
  await user.type(screen.getByLabelText("Egasining ismi"), "Ali")
  await user.click(screen.getByRole("button", { name: "Yaratish" }))

  const create = screen.getByRole("button", { name: "Yaratish" })
  await waitFor(() => expect(create).toBeDisabled())
  expect(create).toHaveAttribute("aria-busy", "true")
})
