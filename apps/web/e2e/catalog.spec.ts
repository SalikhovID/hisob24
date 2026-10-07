import type { Page } from "@playwright/test"
import { seedCatalog } from "../mocks/data"
import { giveRole } from "../test/roles"
import { expect, test } from "./fixtures"
import { choose, onPhone, openSection, sections, sideScroll, signIn } from "./helpers"

// The lists are tables on wide screens and cards on a phone: the one on
// screen is the one a test reads.
const list = (page: Page, name: string) => (onPhone(page) ? page.getByRole("list", { name }) : page.getByRole("table", { name }))

test("the owner keeps the catalog: the lists, a new product, a duplicate refused, the page's actions, the services in their rows", async ({ page }) => {
  const { olma } = seedCatalog()
  await signIn(page, "901234567")
  await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()
  await openSection(page, "Mahsulotlar")
  await expect(page).toHaveURL(/\/products$/)
  await expect(page.getByRole("heading", { level: 1, name: "Mahsulotlar" })).toBeVisible()
  const products = () => list(page, "Mahsulotlar")
  await expect(products().getByRole("link", { name: "Olma" })).toBeVisible()
  await expect(products().getByRole("link", { name: "Nok" })).toBeVisible()
  await expect(products().getByText("Eski mahsulot")).toHaveCount(0)
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)

  // The inactive ones under their own tab.
  await page.getByRole("tab", { name: "Nofaol" }).click()
  await expect(page).toHaveURL(/\/products\?status=inactive$/)
  await expect(products().getByRole("link", { name: "Eski mahsulot" })).toBeVisible()
  await page.getByRole("tab", { name: "Faol", exact: true }).click()
  await expect(page).toHaveURL(/\/products$/)

  // A new product; a name that is taken is refused in the dialog.
  await page.getByRole("button", { name: "Mahsulot qo'shish" }).click()
  const dialog = page.getByRole("dialog", { name: "Mahsulot qo'shish" })
  await dialog.getByLabel("Nomi").fill("Anor")
  await choose(dialog.getByRole("combobox", { name: "Birlik" }), "kg")
  await dialog.getByLabel("Sotuv narxi").fill("8 000")
  await dialog.getByRole("button", { name: "Qo'shish" }).click()
  await expect(dialog).toBeHidden()
  await expect(products().getByRole("link", { name: "Anor" })).toBeVisible()
  await expect(products().getByText(/^8\s000$/)).toBeVisible()
  await page.getByRole("button", { name: "Mahsulot qo'shish" }).click()
  await dialog.getByLabel("Nomi").fill("olma")
  await choose(dialog.getByRole("combobox", { name: "Birlik" }), "dona")
  await dialog.getByRole("button", { name: "Qo'shish" }).click()
  await expect(dialog.getByText("Bu nomli mahsulot allaqachon bor")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(dialog).toBeHidden()

  // The product's page: its facts, an edit, turning it off, the way back.
  await products().getByRole("link", { name: "Olma" }).click()
  await expect(page).toHaveURL(new RegExp(`/products/${olma.id}$`))
  await expect(page.getByRole("heading", { level: 1, name: "Olma" })).toBeVisible()
  await expect(page.getByText("kg · OL-1")).toBeVisible()
  await expect(page.getByRole("main").getByText(/^12\s000$/)).toBeVisible()
  await page.getByRole("button", { name: "Tahrirlash" }).click()
  const edit = page.getByRole("dialog", { name: "Mahsulotni tahrirlash" })
  await expect(edit.getByLabel("Artikul")).toHaveValue("OL-1")
  await edit.getByLabel("Artikul").fill("OL-2")
  await edit.getByRole("button", { name: "Saqlash" }).click()
  await expect(edit).toBeHidden()
  await expect(page.getByText("kg · OL-2")).toBeVisible()
  await page.getByRole("button", { name: "Nofaol qilish" }).click()
  await expect(page.getByText("Nofaol", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Faollashtirish" })).toBeVisible()
  await page.getByRole("main").getByRole("link", { name: "Mahsulotlar" }).click()
  await expect(page).toHaveURL(/\/products$/)
  await expect(products().getByRole("link", { name: "Anor" })).toBeVisible()
  await expect(products().getByRole("link", { name: "Olma" })).toHaveCount(0)

  // Nok is deleted from its page: back to the list, without it.
  await products().getByRole("link", { name: "Nok" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Nok" })).toBeVisible()
  await page.getByRole("button", { name: "O'chirish" }).click()
  await page.getByRole("alertdialog", { name: "Mahsulotni o'chirasizmi?" }).getByRole("button", { name: "O'chirish" }).click()
  await expect(page).toHaveURL(/\/products$/)
  await expect(products().getByRole("link", { name: "Anor" })).toBeVisible()
  await expect(products().getByRole("link", { name: "Nok" })).toHaveCount(0)

  // The services: their own tab, a new one, a change and a deletion in the row.
  await page.getByRole("navigation", { name: "Mahsulotlar bo'limi" }).getByRole("link", { name: "Xizmatlar" }).click()
  await expect(page).toHaveURL(/\/services$/)
  await expect(page.getByRole("heading", { level: 1, name: "Xizmatlar" })).toBeVisible()
  const services = () => list(page, "Xizmatlar")
  await expect(services().getByText("Yetkazish")).toBeVisible()
  await expect(services().getByText(/^50\s000$/)).toBeVisible()
  // On a phone the toasts of the last steps stand over the page's header
  // until they go, and they wait while the pointer rests on them (where the
  // last dialog's button was): the pointer moves off, the toasts go, and the
  // button under them can be pressed.
  await page.mouse.move(8, 300)
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, { timeout: 15_000 })
  await page.getByRole("button", { name: "Xizmat qo'shish" }).click()
  const service = page.getByRole("dialog", { name: "Xizmat qo'shish" })
  await service.getByLabel("Nomi").fill("Ta'mirlash")
  await service.getByLabel("Narx").fill("30000")
  await service.getByRole("button", { name: "Qo'shish" }).click()
  await expect(service).toBeHidden()
  await expect(services().getByText("Ta'mirlash")).toBeVisible()
  await services().getByRole("button", { name: "Tahrirlash: Yetkazish" }).click()
  const editService = page.getByRole("dialog", { name: "Xizmatni tahrirlash" })
  await editService.getByLabel("Narx").fill("55000")
  await editService.getByRole("button", { name: "Saqlash" }).click()
  await expect(editService).toBeHidden()
  await expect(services().getByText(/^55\s000$/)).toBeVisible()
  await services().getByRole("button", { name: "O'chirish: Ta'mirlash" }).click()
  await page.getByRole("alertdialog", { name: "Xizmatni o'chirasizmi?" }).getByRole("button", { name: "O'chirish" }).click()
  await expect(services().getByText("Ta'mirlash")).toHaveCount(0)
  await expect(services().getByText("Yetkazish")).toBeVisible()
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)
})

test("an employee whose role lacks the products has no way to them, and their address leads home", async ({ page }) => {
  seedCatalog()
  giveRole("998902223344", 1, "Kuzatuvchi", ["customers.view"])
  await signIn(page, "902223344")
  await page.getByRole("button", { name: /Olma Savdo/ }).click()
  await expect(page.getByRole("heading", { name: "Salom, Vali Aliyev" })).toBeVisible()

  await expect((await sections(page)).getByRole("link", { name: "Mahsulotlar" })).toHaveCount(0)
  await page.goto("/products")
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole("heading", { name: "Salom, Vali Aliyev" })).toBeVisible()
})
