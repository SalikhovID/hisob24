import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { db } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { CompanyPage } from "./company-page"

const chips = () => within(screen.getByRole("list", { name: "Valyutalar" })).getAllByRole("listitem").map((li) => li.textContent)

// A long flow through several dialogs: more than the usual five seconds under load.
test("a company's currencies are listed, and the dollar is turned on from the dialog; the so'm cannot be turned off", { timeout: 15_000 }, async () => {
  const { user } = renderWithProviders(<CompanyPage id={1} />)

  await screen.findByRole("heading", { name: "Olma Savdo" })
  expect(chips()).toEqual(["UZS — O'zbek so'mi"])

  await user.click(screen.getByRole("button", { name: "O'zgartirish" }))
  const dialog = await screen.findByRole("dialog", { name: "Valyutalar" })
  const som = within(dialog).getByRole("checkbox", { name: /UZS/ })
  expect(som).toBeChecked()
  // Base UI marks a disabled checkbox for assistive technology rather than with the attribute.
  expect(som).toHaveAttribute("aria-disabled", "true")
  expect(within(dialog).getByRole("checkbox", { name: "USD — AQSH dollari" })).not.toBeChecked()
  await user.click(within(dialog).getByRole("checkbox", { name: "USD — AQSH dollari" }))
  await user.click(within(dialog).getByRole("button", { name: "Saqlash" }))

  expect(await screen.findByText("Valyutalar saqlandi")).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  await waitFor(() => expect(chips()).toEqual(["UZS — O'zbek so'mi", "USD — AQSH dollari"]))
  expect(db.currencies[1]).toEqual([1, 2])
})

test("a currency a price is in is not turned off: the dialog says why and stays open", async () => {
  db.currencies[1] = [1, 2, 3]
  db.currencyUse[1] = { 3: 2 }
  const { user } = renderWithProviders(<CompanyPage id={1} />)

  await screen.findByRole("heading", { name: "Olma Savdo" })
  expect(chips()).toEqual(["UZS — O'zbek so'mi", "USD — AQSH dollari", "EUR — Yevro"])
  await user.click(screen.getByRole("button", { name: "O'zgartirish" }))
  const dialog = await screen.findByRole("dialog", { name: "Valyutalar" })
  expect(within(dialog).getByRole("checkbox", { name: "EUR — Yevro" })).toBeChecked()
  await user.click(within(dialog).getByRole("checkbox", { name: "EUR — Yevro" }))
  await user.click(within(dialog).getByRole("button", { name: "Saqlash" }))

  expect(await within(dialog).findByText("Bu valyutada 2 ta mahsulot bor")).toBeInTheDocument()
  expect(db.currencies[1]).toEqual([1, 2, 3])
})
