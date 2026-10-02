import { expect, signIn, test } from "./fixtures"

test("an admin creates a company, adds a user and pays for more days", async ({ page, context, baseURL }) => {
  await signIn(context, baseURL)
  await page.goto("/companies")

  await page.getByRole("link", { name: "Yangi kompaniya" }).click()
  await expect(page).toHaveURL(/\/companies\/new$/)
  await page.getByLabel("Kompaniya nomi").fill("Behi Savdo")
  await page.getByLabel("Tugash sanasi").fill("2026-10-12")
  await page.getByLabel("Egasining telefoni").fill("+998 90 555 66 77")
  await page.getByLabel("Egasining ismi").fill("Sardor")
  await page.getByRole("button", { name: "Yaratish" }).click()

  await expect(page).toHaveURL(/\/companies\/4$/)
  await expect(page.getByRole("heading", { name: "Behi Savdo" })).toBeVisible()
  const info = page.getByRole("region", { name: "Ma'lumot" })
  await expect(info.getByText("10 kun qoldi")).toBeVisible()

  await page.getByRole("button", { name: "User qo'shish" }).click()
  const userDialog = page.getByRole("dialog", { name: "User qo'shish" })
  await userDialog.getByLabel("Telefon").fill("90 111 22 33")
  await userDialog.getByLabel("Ism").fill("Kassir")
  await userDialog.getByLabel("Rol").selectOption("staff")
  await userDialog.getByRole("button", { name: "Qo'shish" }).click()
  await expect(userDialog).toBeHidden()
  await expect(page.getByText("+998 90 111 22 33").filter({ visible: true })).toBeVisible()

  await page.getByRole("button", { name: "Billing qo'shish" }).click()
  const billing = page.getByRole("dialog", { name: "Billing qo'shish" })
  await billing.getByLabel("Kunlar soni").fill("30")
  await expect(billing.getByText(/Yangi tugash sanasi/)).toHaveText("Yangi tugash sanasi: 11.11.2026")
  await billing.getByLabel("Summa").fill("250000")
  await billing.getByRole("button", { name: "Qo'shish" }).click()
  await expect(billing).toBeHidden()

  await expect(info.getByText("11.11.2026")).toBeVisible()
  await expect(page.getByText("12.10.2026 → 11.11.2026").filter({ visible: true })).toBeVisible()
  await expect(page.getByText("250 000,00").filter({ visible: true })).toBeVisible()
})

test("the list searches and filters the companies", async ({ page, context, baseURL }) => {
  await signIn(context, baseURL)
  await page.goto("/companies")

  await page.getByRole("searchbox", { name: "Qidirish" }).fill("olma")
  await expect(page).toHaveURL(/\/companies\?search=olma$/)
  await expect(page.getByText("Olma Savdo").filter({ visible: true })).toBeVisible()
  await expect(page.getByText("Nok Market").filter({ visible: true })).toHaveCount(0)

  await page.getByRole("searchbox", { name: "Qidirish" }).fill("")
  await page.getByRole("tab", { name: "Muddati o'tgan" }).click()
  await expect(page).toHaveURL(/status=expired/)
  await expect(page.getByText("Olcha Servis").filter({ visible: true })).toBeVisible()
  await expect(page.getByText("Olma Savdo").filter({ visible: true })).toHaveCount(0)
})
