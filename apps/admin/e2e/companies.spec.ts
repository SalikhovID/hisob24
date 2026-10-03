import { expect, signIn, test } from "./fixtures"

test("an admin creates a company, replaces its owner and pays for more days", async ({ page, context, baseURL }) => {
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

  // The company starts with the owner it was created with.
  await expect(page.getByText("+998 90 555 66 77").filter({ visible: true })).toBeVisible()
  await expect(page.getByText("Egasi", { exact: true }).filter({ visible: true })).toBeVisible()
  await expect(page.getByText("Xodim", { exact: true }).filter({ visible: true })).toHaveCount(0)

  await page.getByRole("button", { name: "Egasini almashtirish" }).click()
  const ownerDialog = page.getByRole("dialog", { name: "Egasini almashtirish" })
  await ownerDialog.getByLabel("Telefon").fill("90 111 22 33")
  await ownerDialog.getByLabel("Ism").fill("Yangi Egasi")
  await ownerDialog.getByRole("button", { name: "Almashtirish" }).click()
  await expect(ownerDialog).toBeHidden()
  // The new owner joins; the one before stays in the company as an employee.
  await expect(page.getByText("+998 90 111 22 33").filter({ visible: true })).toBeVisible()
  await expect(page.getByText("+998 90 555 66 77").filter({ visible: true })).toBeVisible()
  await expect(page.getByText("Egasi", { exact: true }).filter({ visible: true })).toHaveCount(1)
  await expect(page.getByText("Xodim", { exact: true }).filter({ visible: true })).toHaveCount(1)

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
