import { expect, signIn, test } from "./fixtures"

test("an admin adds another admin and turns them off", async ({ page, context, baseURL }) => {
  await signIn(context, baseURL)
  await page.goto("/admins")

  await page.getByRole("button", { name: "Admin qo'shish" }).click()
  const dialog = page.getByRole("dialog", { name: "Admin qo'shish" })
  await dialog.getByLabel("Telegram ID").fill("1000000001")
  await dialog.getByLabel("Ism").fill("Yangi Admin")
  await dialog.getByRole("button", { name: "Qo'shish" }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText("Yangi Admin").filter({ visible: true })).toBeVisible()

  await page.getByRole("button", { name: "O'chirish: Yangi Admin" }).filter({ visible: true }).click()
  const confirm = page.getByRole("alertdialog", { name: "Adminni o'chirasizmi?" })
  await confirm.getByRole("button", { name: "O'chirish" }).click()

  await expect(page.getByText("Admin o'chirildi")).toBeVisible()
  await expect(page.getByText("Nofaol").filter({ visible: true })).toBeVisible()
  await expect(page.getByRole("button", { name: /O'chirish: Owner/ })).toHaveCount(0)
})
