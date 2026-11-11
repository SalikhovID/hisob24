import type { Locator, Page } from "@playwright/test"
import { addDays, localToday } from "../mocks/data"
import { expect, test } from "./fixtures"
import { boardOf, onPhone, openSection, signIn } from "./helpers"

const today = localToday()

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

test("on a phone the order is entered on a screen of its own: all of the phone, square, no handle, nothing of the page above it", async ({ page }) => {
  test.skip(!onPhone(page), "a sheet from the bottom is a phone's")
  const dialog = await openAddOrder(page)
  const phone = page.viewportSize()!

  await expect.poll(() => dialog.boundingBox()).toEqual({ x: 0, y: 0, width: phone.width, height: phone.height })
  await expect(dialog).toHaveCSS("border-top-left-radius", "0px")
  await expect(dialog).toHaveCSS("border-top-right-radius", "0px")
  await expect(dialog.locator('[data-slot="dialog-grab"]')).toHaveCount(0)
  // Its title heads the screen, and the close button is at the title's level.
  const title = await dialog.getByText("Buyurtma qo'shish", { exact: true }).boundingBox()
  const close = await dialog.getByRole("button", { name: "Yopish" }).boundingBox()
  expect(title!.y).toBeLessThan(40)
  expect(close!.y).toBeLessThan(40)
})

test("on a phone every field of the order's form has an edge of its own, none is white on a white card", async ({ page }) => {
  test.skip(!onPhone(page), "a phone's field stands on a card of its own colour")
  const dialog = await openAddOrder(page)
  await dialog.getByRole("button", { name: /Qator qo'shish/ }).click()
  await dialog.getByRole("button", { name: /To'lov qo'shish/ }).click()
  // The amount just added holds the focus, whose ring is another one.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())

  // The customer's phone, the name, the source, the deadline, the stage,
  // the assignee, the price, the product, the quantity, the account, the amount.
  const boxes = dialog.locator('[data-slot="field-box"]')
  expect(await boxes.count()).toBeGreaterThanOrEqual(10)
  for (const box of await boxes.all()) await expect(box).toHaveCSS("box-shadow", /0px 0px 0px 1px inset$/)
})

test("the customer's phone has its label over its box, in the column of the other fields' boxes, not beside them", async ({ page }) => {
  const dialog = await openAddOrder(page)
  const customer = dialog.getByRole("group", { name: "Mijoz" })
  const boxOf = (field: Locator) => field.locator('xpath=ancestor::*[@data-slot="field-box"]').boundingBox()
  const label = (await customer.locator("label", { hasText: "Telefon raqami" }).boundingBox())!
  const phone = (await boxOf(customer.getByRole("combobox", { name: "Telefon raqami" })))!
  const name = (await boxOf(customer.getByLabel("F.I.Sh.")))!

  // Over the box, not at its left.
  expect(label.y + label.height).toBeLessThanOrEqual(phone.y)
  // The box is the width of a name's: the same two edges.
  expect(phone.x).toBeCloseTo(name.x, 0)
  expect(phone.width).toBeCloseTo(name.width, 0)
})

// hintOf is the «Sanani tanlang» drawn over the deadline's native date input,
// which is blank on some phones while no day is chosen.
const hintOf = (dialog: Locator) =>
  dialog.getByLabel("Muddat").locator('xpath=ancestor::*[@data-slot="field-box"]').locator('[data-slot="date-hint"]')

test("on a phone an empty deadline says «Sanani tanlang» over the blank date input, a press goes through to the input, a chosen day takes it away", async ({ page }) => {
  test.skip(!onPhone(page), "the hint is a phone's: the web draws its own date segments")
  const dialog = await openAddOrder(page)
  const hint = hintOf(dialog)
  await expect(hint).toBeVisible()
  await expect(hint).toHaveText("Sanani tanlang")

  // The hint stands inside the box's edge: its own ground does not paint over
  // the ring along the top and the bottom (1px, 1.5px while focused).
  await hint.scrollIntoViewIfNeeded()
  const at = (await hint.boundingBox())!
  const box = (await dialog.getByLabel("Muddat").locator('xpath=ancestor::*[@data-slot="field-box"]').boundingBox())!
  expect(at.y).toBeGreaterThanOrEqual(box.y + 1.5)
  expect(at.y + at.height).toBeLessThanOrEqual(box.y + box.height - 1.5)

  // A press in the middle of the hint reaches the input under it.
  const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.tagName, [at.x + at.width / 2, at.y + at.height / 2])
  expect(hit).toBe("INPUT")

  await dialog.getByLabel("Muddat").fill(addDays(today, 2))
  await expect(hint).toHaveCount(0)
})

test("on a wide screen the empty deadline shows the browser's own date segments, no hint over them", async ({ page }) => {
  test.skip(onPhone(page), "the web draws its own date segments")
  const dialog = await openAddOrder(page)
  await expect(hintOf(dialog)).toHaveCount(1)
  await expect(hintOf(dialog)).toBeHidden()
})

test("on a wide screen the order is still the dialog in the middle of the screen", async ({ page }) => {
  test.skip(onPhone(page), "a dialog in the middle is a wide screen's")
  const dialog = await openAddOrder(page)
  const screen = page.viewportSize()!

  await expect.poll(async () => (await dialog.boundingBox())?.width).toBe(480)
  const box = (await dialog.boundingBox())!
  expect(box.x).toBeCloseTo((screen.width - 480) / 2, 0)
  expect(box.y).toBeGreaterThan(0)
  await expect(dialog).toHaveCSS("border-top-left-radius", "12px")
  // The slide in from the right is a phone's alone.
  await expect(dialog).toHaveCSS("animation-name", "none")
})

test("on a phone the order's screen comes in from the right, not up from the bottom", async ({ page }) => {
  test.skip(!onPhone(page), "a sheet from the bottom is a phone's")
  await signIn(page, "901234567")
  await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()
  await openSection(page, "Buyurtmalar")
  await expect(page).toHaveURL(/\/orders$/)
  await expect(boardOf(page)).toBeVisible()
  // Where it stands in the first frame it is drawn in, before it has moved.
  const firstFrame = page.evaluate(
    () =>
      new Promise<{ x: number; y: number }>((resolve) => {
        const look = () => {
          const popup = document.querySelector('[data-slot="dialog-content"]')
          if (!popup) return requestAnimationFrame(look)
          const { x, y } = popup.getBoundingClientRect()
          resolve({ x, y })
        }
        look()
      }),
  )
  await page.getByRole("button", { name: "Buyurtma qo'shish", exact: true }).click()
  const { x, y } = await firstFrame
  expect(x).toBeGreaterThan(page.viewportSize()!.width / 2)
  expect(y).toBe(0)
  // It ends where the phone is.
  const dialog = page.getByRole("dialog", { name: "Buyurtma qo'shish" })
  await expect.poll(async () => (await dialog.boundingBox())?.x).toBe(0)
})
