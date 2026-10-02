import { LOGIN_CODE } from "../mocks/data"
import { test } from "./fixtures"

const out = "/private/tmp/claude-501/-Users-salikhov-id-www-hisob24/9bc37ee1-bcd8-434d-9d4b-b765a859464e/scratchpad/shots"

test("screens", async ({ page }, info) => {
  await page.goto("/login")
  await page.screenshot({ caret: "initial", path: `${out}/${info.project.name}-login.png` })
  await page.getByRole("textbox", { name: "Kod" }).fill(LOGIN_CODE)
  await page.waitForURL(/\/companies$/)
  await page.getByRole("heading", { name: "Kompaniyalar" }).waitFor()
  await page.waitForTimeout(500)
  await page.screenshot({ caret: "initial", path: `${out}/${info.project.name}-companies.png`, fullPage: true })
  if (info.project.name === "mobile") {
    await page.getByRole("button", { name: "Menyu" }).click()
    await page.waitForTimeout(400)
    await page.screenshot({ caret: "initial", path: `${out}/${info.project.name}-menu.png` })
  }
})
