import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, db, nextId, VALI } from "@/mocks/data"
import { currentUrl, router, setLocation } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { rowParts } from "@/test/rows"
import { giveRole } from "@/test/roles"
import { choose } from "@/test/select"
import { chooseCompany, signIn } from "@/test/session"
import { enterConversion, enterMoneyTransfer } from "@/test/finance"
import { MoneyTransfersPage } from "./money-transfers-page"

async function moved() {
  db.currencies[1].push(2)
  const cash = db.accounts[1][0].id
  const kassa2 = { id: nextId(), name: "Kassa 2", currency_id: 1, is_active: true }
  const card = { id: nextId(), name: "Karta", currency_id: 2, is_active: true }
  db.accounts[1].push(kassa2, card)
  await signIn(ALI)
  const transfer = await enterMoneyTransfer({ from_account_id: cash, to_account_id: kassa2.id, amount: "100000", at: "2026-10-05T09:00:00+05:00" })
  const conversion = await enterConversion({ from_account_id: cash, amount: "128000", to_account_id: card.id, to_amount: "10", at: "2026-10-06T09:00:00+05:00" })
  return { cash, kassa2, card, transfer, conversion }
}

// parts are a row's title, line and end, the spaces as one plain space.
const parts = (row: HTMLElement) => {
  const plain = (text: string | null) => text?.replace(/\s+/g, " ") ?? null
  const { title, sub, end } = rowParts(row)
  return { title: plain(title), sub: plain(sub), end: plain(end) }
}
// day is the rows of a day's group in the list.
const day = (list: HTMLElement, name: string) => within(within(list).getByRole("list", { name })).getAllByRole("listitem").map((item) => item.firstElementChild as HTMLElement)

test("the transfers and the conversions as the prototype's list: by their day, the newest first, each by its kind and number, its time, the accounts and who entered it under it, what left at its end (and what arrived, for a conversion); an account narrows it and stays in the address", async () => {
  const { kassa2 } = await moved()
  setLocation("/money-transfers")
  const { user } = renderWithProviders(<MoneyTransfersPage />)

  const list = await screen.findByRole("region", { name: "O'tkazmalar" })
  expect(screen.getByRole("heading", { level: 1, name: "O'tkazmalar" })).toBeInTheDocument()
  expect(within(screen.getByRole("navigation", { name: "Moliya bo'limi" })).getByRole("link", { name: "O'tkazmalar" })).toHaveAttribute("aria-current", "page")
  expect(day(list, "6-oktabr, seshanba").map(parts)).toEqual([{ title: "Konvertatsiya № 1", sub: "09:00 · Naqd → Karta · Ali V.", end: "128 000 so'm → 10 $" }])
  // What arrived stands under what left: the row's end stays narrow.
  const [conversion] = day(list, "6-oktabr, seshanba")
  expect(conversion.querySelector("[data-slot=row-value]")).toHaveTextContent("128 000 so'm")
  expect(conversion.querySelector("[data-slot=row-end-sub]")).toHaveTextContent("→ 10 $")
  expect(day(list, "5-oktabr, dushanba").map(parts)).toEqual([{ title: "O'tkazma № 1", sub: "09:00 · Naqd → Kassa 2 · Ali V.", end: "100 000 so'm" }])
  expect(screen.getByText("Jami: 2")).toBeInTheDocument()

  await choose(user, screen.getByRole("button", { name: "Akkaunt" }), "Kassa 2 (so'm)")
  await waitFor(() => expect(currentUrl()).toBe(`/money-transfers?account_id=${kassa2.id}`))
  await waitFor(() => expect(within(screen.getByRole("region", { name: "O'tkazmalar" })).getAllByRole("listitem")).toHaveLength(1))
  expect(screen.getByRole("button", { name: "Kassa 2" })).toHaveAttribute("aria-pressed", "true")
})

test("a row opens the sheet of its actions: a conversion (its rate said there) or a transfer edited in its own sheet, deleted after asking", async () => {
  await moved()
  setLocation("/money-transfers")
  const { user } = renderWithProviders(<MoneyTransfersPage />)
  const list = await screen.findByRole("region", { name: "O'tkazmalar" })
  const [conversion] = day(list, "6-oktabr, seshanba")
  const [transfer] = day(list, "5-oktabr, dushanba")

  await user.click(conversion)
  const sheet = await screen.findByRole("menu")
  expect(sheet).toHaveTextContent("Konvertatsiya № 1 · 128 000 so'm → 10 $ · 1 $ = 12 800 so'm")
  expect(within(sheet).getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Tahrirlash", "O'chirish"])
  await user.click(within(sheet).getByRole("menuitem", { name: "Tahrirlash" }))
  expect(within(await screen.findByRole("dialog", { name: "Konvertatsiyani tahrirlash" })).getByLabelText("Chiqdi")).toHaveValue("128000.00")
  await user.keyboard("{Escape}")
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())

  await user.click(transfer)
  await user.click(within(await screen.findByRole("menu")).getByRole("menuitem", { name: "Tahrirlash" }))
  expect(within(await screen.findByRole("dialog", { name: "O'tkazmani tahrirlash" })).getByLabelText("Summa")).toHaveValue("100000.00")
  await user.keyboard("{Escape}")
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())

  await user.click(transfer)
  await user.click(within(await screen.findByRole("menu")).getByRole("menuitem", { name: "O'chirish" }))
  expect(await screen.findByRole("alertdialog", { name: "Hujjatni o'chirasizmi?" })).toBeInTheDocument()
})

test("the plus offers a transfer or a conversion, each in its sheet", async () => {
  await moved()
  setLocation("/money-transfers")
  const { user } = renderWithProviders(<MoneyTransfersPage />)

  await user.click(await screen.findByRole("button", { name: "O'tkazma qo'shish" }))
  const offer = await screen.findByRole("menu")
  expect(within(offer).getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["O'tkazma", "Konvertatsiya"])
  await user.click(within(offer).getByRole("menuitem", { name: "Konvertatsiya" }))
  expect(await screen.findByRole("dialog", { name: "Konvertatsiya qo'shish" })).toBeInTheDocument()
  await user.keyboard("{Escape}")
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())

  await user.click(screen.getByRole("button", { name: "O'tkazma qo'shish" }))
  await user.click(within(await screen.findByRole("menu")).getByRole("menuitem", { name: "O'tkazma" }))
  expect(await screen.findByRole("dialog", { name: "O'tkazma qo'shish" })).toBeInTheDocument()
})

test("whoever may see the finance alone sees the rows without their sheet and no plus", async () => {
  await moved()
  giveRole(VALI, 1, "Kuzatuvchi", ["finance.view"])
  db.cooldown = false
  await signIn(VALI)
  await chooseCompany(1)
  setLocation("/money-transfers")
  renderWithProviders(<MoneyTransfersPage />)
  const [conversion] = day(await screen.findByRole("region", { name: "O'tkazmalar" }), "6-oktabr, seshanba")
  expect(conversion.tagName).toBe("DIV")
  expect(screen.queryByRole("button", { name: "O'tkazma qo'shish" })).not.toBeInTheDocument()
})

test("none yet says so; whoever may not see the finance is sent home", async () => {
  await signIn(ALI)
  setLocation("/money-transfers")
  const { unmount } = renderWithProviders(<MoneyTransfersPage />)
  expect(await screen.findByText("Hali o'tkazma yo'q")).toBeInTheDocument()
  expect(screen.getByText("Birinchi o'tkazmani «O'tkazma qo'shish» tugmasi orqali kiriting.")).toBeInTheDocument()
  unmount()

  giveRole(VALI, 1, "Kuzatuvchi", ["customers.view"])
  db.cooldown = false
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<MoneyTransfersPage />)
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"))
})
