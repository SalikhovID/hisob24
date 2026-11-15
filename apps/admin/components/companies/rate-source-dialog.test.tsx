import { screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { expect, test } from "vitest"
import { db } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { choose } from "@/test/select"
import { server } from "@/test/server"
import { CompanyPage } from "./company-page"

// The section of the company's rates (logic/currencies.md, section 4).
const rates = () => screen.getByRole("region", { name: "Valyuta kurslari" })

test("the page tells where the company takes its rates and the step; the admin changes them in the dialog", { timeout: 15_000 }, async () => {
  const { user } = renderWithProviders(<CompanyPage id={1} />)

  await screen.findByRole("heading", { name: "Olma Savdo" })
  expect(within(rates()).getByText("Markaziy bank")).toBeInTheDocument()
  // getByText collapses the no-break space of the thousands, as the spaces.
  expect(within(rates()).getByText("100 so'mgacha · USD, EUR")).toBeInTheDocument()
  expect(within(rates()).getByText("Har kuni 00:00 (UTC+5)")).toBeInTheDocument()

  await user.click(within(rates()).getByRole("button", { name: "Kurs manbaini o'zgartirish" }))
  const dialog = await screen.findByRole("dialog", { name: "Valyuta kurslari" })
  expect(within(dialog).getByLabelText("Manba")).toHaveTextContent("Markaziy bank")
  expect(within(dialog).getByLabelText("Yaxlitlash")).toHaveTextContent("100 so'm")
  await choose(user, within(dialog).getByLabelText("Manba"), "Kapitalbank")
  // An option's accessible name keeps the no-break space; getByText's matching does not.
  await choose(user, within(dialog).getByLabelText("Yaxlitlash"), "1\u00a0000 so'm")
  await user.click(within(dialog).getByRole("button", { name: "Saqlash" }))

  expect(await screen.findByText("Kurs manbai saqlandi")).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  await waitFor(() => expect(within(rates()).getByText("Kapitalbank")).toBeInTheDocument())
  expect(within(rates()).getByText("1 000 so'mgacha · USD, EUR")).toBeInTheDocument()
  expect(db.rateSources[1]).toEqual({ source: "kapitalbank", rounding: 1000 })
})

test("by hand there is nothing to round: the dialog turns the step off and the page says none", { timeout: 15_000 }, async () => {
  const { user } = renderWithProviders(<CompanyPage id={1} />)

  await screen.findByRole("heading", { name: "Olma Savdo" })
  await user.click(within(rates()).getByRole("button", { name: "Kurs manbaini o'zgartirish" }))
  const dialog = await screen.findByRole("dialog", { name: "Valyuta kurslari" })
  await choose(user, within(dialog).getByLabelText("Manba"), "Qo'lda")
  expect(within(dialog).getByLabelText("Yaxlitlash")).toBeDisabled()
  await user.click(within(dialog).getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(within(rates()).getByText("Qo'lda")).toBeInTheDocument())
  expect(within(rates()).getByText("—")).toBeInTheDocument()
  expect(db.rateSources[1]).toEqual({ source: "manual", rounding: 100 })
})

test("a refusal stays in the dialog", async () => {
  server.use(http.put("*/api/admin/companies/:id/rate-source", () => HttpResponse.json({ error: "validation_error", message: "Manba noto'g'ri" }, { status: 400 })))
  const { user } = renderWithProviders(<CompanyPage id={1} />)

  await screen.findByRole("heading", { name: "Olma Savdo" })
  await user.click(within(rates()).getByRole("button", { name: "Kurs manbaini o'zgartirish" }))
  const dialog = await screen.findByRole("dialog", { name: "Valyuta kurslari" })
  await user.click(within(dialog).getByRole("button", { name: "Saqlash" }))

  expect(await within(dialog).findByText("Manba noto'g'ri")).toBeInTheDocument()
  expect(db.rateSources[1]).toEqual({ source: "cbu", rounding: 100 })
})
