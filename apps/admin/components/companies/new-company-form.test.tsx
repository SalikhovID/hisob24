import { fireEvent, screen, waitFor } from "@testing-library/react"
import { http, HttpResponse } from "msw"
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
