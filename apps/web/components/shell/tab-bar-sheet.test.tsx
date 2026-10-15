import { screen, within } from "@testing-library/react"
import { expect, test, vi } from "vitest"
import { ALI, db, VALI } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { giveRole } from "@/test/roles"
import { chooseCompany, signIn } from "@/test/session"
import { TabBarSheet } from "./tab-bar-sheet"

const sheet = () => screen.findByRole("dialog", { name: "Pastki panel" })
// named is the pages a list's buttons of a kind name ("Olib tashlash: …").
const named = (list: HTMLElement, kind: string) =>
  within(list)
    .queryAllByRole("button", { name: new RegExp(`^${kind}: `) })
    .map((button) => button.getAttribute("aria-label")!.slice(kind.length + 2))
const inBar = (scope: HTMLElement) => named(within(scope).getByRole("list", { name: "Panelda" }), "Olib tashlash")
const toAdd = (scope: HTMLElement, group: string) => named(within(scope).getByRole("list", { name: group }), "Qo'shish")

test("the sheet starts from the bar as it is: its pages in their order, the rest to add under their sections", async () => {
  db.members[ALI][0].tabBar = ["purchases", "home"]
  await signIn(ALI)
  renderWithProviders(<TabBarSheet open onOpenChange={vi.fn()} />)

  const bar = await sheet()
  expect(within(bar).getByText("Panelda 4 tagacha sahifa turadi, qolganlari «Sozlama» ichida. Tartibini tutqichdan sudrab o'zgartiring.")).toBeInTheDocument()
  expect(await within(bar).findByRole("heading", { name: "Panelda · 2/4" })).toBeInTheDocument()
  expect(inBar(bar)).toEqual(["Xaridlar", "Bosh sahifa"])
  expect(toAdd(bar, "Bo'limlar")).toEqual(["Mijozlar", "Vazifalar", "Sotuv", "Xodimlar"])
  expect(toAdd(bar, "Mahsulotlar")).toEqual(["Mahsulotlar", "Xizmatlar"])
  expect(toAdd(bar, "Ombor")).toEqual(["Ombor", "Ko'chirishlar", "Inventarizatsiya", "Boshlang'ich qoldiq", "Ta'minotchilar"])
  expect(toAdd(bar, "Moliya")).toEqual(["Kassa", "Xarajatlar", "O'tkazmalar"])
  expect(within(bar).queryByRole("list", { name: "Sozlamalar" })).not.toBeInTheDocument()
})

test("an employee chooses among the pages their role opens; without a bar of their own, the default one", async () => {
  giveRole(VALI, 1, "Sotuvchi", ["sales.view", "finance.view"])
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<TabBarSheet open onOpenChange={vi.fn()} />)

  const bar = await sheet()
  expect(await within(bar).findByRole("heading", { name: "Panelda · 3/4" })).toBeInTheDocument()
  expect(inBar(bar)).toEqual(["Bosh sahifa", "Sotuv", "Kassa"])
  expect(toAdd(bar, "Moliya")).toEqual(["Xarajatlar", "O'tkazmalar"])
  expect(within(bar).queryByRole("list", { name: "Bo'limlar" })).not.toBeInTheDocument()
  expect(within(bar).queryByRole("list", { name: "Ombor" })).not.toBeInTheDocument()
})

test("a page taken out goes back among the rest, one added goes last; a full bar takes no more", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<TabBarSheet open onOpenChange={vi.fn()} />)

  const bar = await sheet()
  await within(bar).findByRole("heading", { name: "Panelda · 4/4" })
  const full = "Ko'pi bilan 4 ta sahifa — yangisini qo'shish uchun avval birini olib tashlang."
  expect(within(bar).getByText(full)).toBeInTheDocument()
  expect(within(bar).getByRole("button", { name: "Qo'shish: Sotuv" })).toBeDisabled()

  await user.click(within(bar).getByRole("button", { name: "Olib tashlash: Vazifalar" }))
  expect(inBar(bar)).toEqual(["Bosh sahifa", "Mijozlar", "Mahsulotlar"])
  expect(toAdd(bar, "Bo'limlar")).toEqual(["Vazifalar", "Sotuv", "Xodimlar"])
  expect(within(bar).queryByText(full)).not.toBeInTheDocument()
  expect(within(bar).getByRole("button", { name: "Qo'shish: Sotuv" })).toBeEnabled()

  await user.click(within(bar).getByRole("button", { name: "Qo'shish: Xaridlar" }))
  expect(inBar(bar)).toEqual(["Bosh sahifa", "Mijozlar", "Mahsulotlar", "Xaridlar"])
  expect(within(bar).getByRole("heading", { name: "Panelda · 4/4" })).toBeInTheDocument()
})

test("a bar with every page taken out says what to do", async () => {
  db.members[ALI][0].tabBar = ["home"]
  await signIn(ALI)
  const { user } = renderWithProviders(<TabBarSheet open onOpenChange={vi.fn()} />)

  const bar = await sheet()
  await user.click(await within(bar).findByRole("button", { name: "Olib tashlash: Bosh sahifa" }))
  expect(within(bar).getByRole("heading", { name: "Panelda · 0/4" })).toBeInTheDocument()
  expect(within(bar).getByText("Panelda sahifa yo'q — pastdagi ro'yxatdan qo'shing.")).toBeInTheDocument()
})
