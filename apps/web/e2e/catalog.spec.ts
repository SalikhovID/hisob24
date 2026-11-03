import type { Locator, Page } from "@playwright/test"
import { seedCatalog } from "../mocks/data"
import { giveRole } from "../test/roles"
import { expect, test } from "./fixtures"
import { back, choose, list, onPhone, openSection, sections, sideScroll, signIn } from "./helpers"

// rowOf is a record's row as the screen draws it: a phone's row (a link,
// or a button that opens a service's actions), the web table's row (its
// name the link, its price a cell of its own; a press opens it too).
const rowOf = (page: Page, scope: Locator, name: string, role: "link" | "button") =>
  onPhone(page) ? scope.getByRole(role, { name: new RegExp(`^${name}`) }) : scope.getByRole("row").filter({ hasText: name })

// status is the chip of the active or the inactive records.
const status = (page: Page, name: RegExp) => page.getByRole("radiogroup", { name: "Holat" }).getByRole("radio", { name })

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

  // The inactive ones under their own chip.
  await status(page, /^Nofaol/).click()
  await expect(page).toHaveURL(/\/products\?status=inactive$/)
  await expect(products().getByRole("link", { name: "Eski mahsulot" })).toBeVisible()
  await status(page, /^Faol/).click()
  await expect(page).toHaveURL(/\/products$/)

  // A new product; a name that is taken is refused in the dialog.
  await page.getByRole("button", { name: "Mahsulot qo'shish" }).click()
  const dialog = page.getByRole("dialog", { name: "Mahsulot qo'shish" })
  await dialog.getByLabel("Nomi").fill("Anor")
  await choose(dialog.getByLabel("Birlik"), "kg")
  await dialog.getByLabel("Sotuv narxi").fill("8 000")
  await dialog.getByRole("button", { name: "Qo'shish" }).click()
  await expect(dialog).toBeHidden()
  await expect(rowOf(page, products(), "Anor", "link")).toContainText(/8\s000/)
  await page.getByRole("button", { name: "Mahsulot qo'shish" }).click()
  await dialog.getByLabel("Nomi").fill("olma")
  await choose(dialog.getByLabel("Birlik"), "dona")
  await dialog.getByRole("button", { name: "Qo'shish" }).click()
  await expect(dialog.getByText("Bu nomli mahsulot allaqachon bor")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(dialog).toBeHidden()

  // The product's page: its facts, an edit, turning it off, the way back.
  await products().getByRole("link", { name: "Olma" }).click()
  await expect(page).toHaveURL(new RegExp(`/products/${olma.id}$`))
  await expect(page.getByRole("heading", { level: 1, name: "Olma" })).toBeVisible()
  await expect(page.getByText("kg · OL-1")).toBeVisible()
  // The sale price is among the facts; the actions stand by the title.
  await expect(page.getByRole("region", { name: "Ma'lumot" }).getByText(/^12\s000 so'm$/)).toBeVisible()
  await expect(page.getByRole("group", { name: "Amallar" })).toContainText("Nofaol qilish")
  // Nothing bought yet: the stock of the location is 0, the last price none.
  await expect(page.getByRole("region", { name: "Qoldiq" }).getByText("0 kg")).toBeVisible()
  await expect(page.getByText("Bu mahsulot hali xarid qilinmagan")).toBeVisible()
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
  await back(page, "Mahsulotlar")
  await expect(page).toHaveURL(/\/products$/)
  await expect(products().getByRole("link", { name: "Anor" })).toBeVisible()
  await expect(products().getByRole("link", { name: "Olma" })).toHaveCount(0)

  // Nok is deleted from its page: back to the list, without it.
  await products().getByRole("link", { name: "Nok" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Nok" })).toBeVisible()
  await page.getByRole("button", { name: "Mahsulotni o'chirish" }).click()
  await page.getByRole("alertdialog", { name: "Mahsulotni o'chirasizmi?" }).getByRole("button", { name: "O'chirish" }).click()
  await expect(page).toHaveURL(/\/products$/)
  await expect(products().getByRole("link", { name: "Anor" })).toBeVisible()
  await expect(products().getByRole("link", { name: "Nok" })).toHaveCount(0)

  // The services: their own tab, a new one, a change and a deletion from a row's sheet.
  await page.getByRole("navigation", { name: "Mahsulotlar bo'limi" }).getByRole("link", { name: "Xizmatlar" }).click()
  await expect(page).toHaveURL(/\/services$/)
  await expect(page.getByRole("heading", { level: 1, name: "Xizmatlar" })).toBeVisible()
  const services = () => list(page, "Xizmatlar")
  await expect(services().getByText("Yetkazish")).toBeVisible()
  await expect(rowOf(page, services(), "Yetkazish", "button")).toContainText(/50\s000/)
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
  await rowOf(page, services(), "Yetkazish", "button").click()
  await page.getByRole("menuitem", { name: "Tahrirlash" }).click()
  const editService = page.getByRole("dialog", { name: "Xizmatni tahrirlash" })
  await editService.getByLabel("Narx").fill("55000")
  await editService.getByRole("button", { name: "Saqlash" }).click()
  await expect(editService).toBeHidden()
  await expect(rowOf(page, services(), "Yetkazish", "button")).toContainText(/55\s000/)
  await rowOf(page, services(), "Ta'mirlash", "button").click()
  await page.getByRole("menuitem", { name: "O'chirish" }).click()
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
