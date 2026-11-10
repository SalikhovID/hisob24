import type { Page } from "@playwright/test"
import { expect, test } from "./fixtures"
import { boardOf, onPhone, openSection, signIn } from "./helpers"

// openAddOrder signs the owner of Olma Savdo in, opens the orders and presses
// «Buyurtma qo'shish»: the order's entry, measured where it stops, not on its
// way in.
async function openAddOrder(page: Page) {
  await signIn(page, "901234567")
  await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()
  await openSection(page, "Buyurtmalar")
  await expect(page).toHaveURL(/\/orders$/)
  await expect(boardOf(page)).toBeVisible()
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.getByRole("button", { name: "Buyurtma qo'shish", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Buyurtma qo'shish" })
  await expect(dialog).toBeVisible()
  return dialog
}

test("a thumb moves the order's form up and down only, however wide something in it is", async ({ page }) => {
  test.skip(!onPhone(page), "a thumb is a phone's")
  const dialog = await openAddOrder(page)
  const body = dialog.locator('[data-slot="dialog-body"]')
  // Something a little wider than the form: the least that lets a scroller
  // be moved sideways.
  await body.evaluate((element) => {
    const wide = document.createElement("div")
    wide.style.cssText = `width:${element.clientWidth + 40}px;height:1px`
    element.append(wide)
  })
  const touch = await page.context().newCDPSession(page)
  const swipe = (dx: number, dy: number) =>
    touch.send("Input.synthesizeScrollGesture", { x: 180, y: 500, xDistance: dx, yDistance: dy, gestureSourceType: "touch", speed: 800 })
  const moved = () => body.evaluate((element) => ({ left: element.scrollLeft, top: element.scrollTop }))

  await swipe(-40, 0)
  expect((await moved()).left).toBe(0)
  // Up and down it still goes.
  await swipe(0, -200)
  const afterUp = await moved()
  expect(afterUp.top).toBeGreaterThan(0)
  expect(afterUp.left).toBe(0)
})
