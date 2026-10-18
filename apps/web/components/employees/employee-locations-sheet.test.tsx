import { screen, waitFor, within } from "@testing-library/react"
import { type ComponentProps, useState } from "react"
import { expect, test } from "vitest"
import { ALI, db, membersOf, seedOrders, VALI } from "@/mocks/data"
import { addLocation } from "@/test/locations"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import { EmployeeLocationsSheet } from "./employee-locations-sheet"

// Opened is the sheet as the employee's sheet opens it: open from the
// start, closed when it says so.
function Opened(props: Omit<ComponentProps<typeof EmployeeLocationsSheet>, "open" | "onOpenChange">) {
  const [open, setOpen] = useState(true)
  return <EmployeeLocationsSheet {...props} open={open} onOpenChange={setOpen} />
}

const vali = () => membersOf(1).find((m) => m.phone === VALI)!
const locationIdsOf = () => db.members[VALI].find((m) => m.companyId === 1)?.locationIds
// A location's row is a checkbox; while every location is on, the rows say so and wait.
const disabled = (row: HTMLElement) => row.hasAttribute("disabled") || row.getAttribute("aria-disabled") === "true"

test("the owner restricts an employee to some locations in the prototype's sheet, and lifts the restriction again", async () => {
  const chilonzor = addLocation(1, "Chilonzor")
  await signIn(ALI)
  const { user, unmount } = renderWithProviders(<Opened companyId={1} employee={vali()} />)

  const sheet = await screen.findByRole("dialog", { name: "Lokatsiyalarni o'zgartirish" })
  expect(sheet).toHaveAccessibleDescription("Xodim faqat belgilangan lokatsiyalarning vazifalarini ko'radi va qo'shadi.")
  const all = within(sheet).getByRole("switch", { name: "Barcha lokatsiyalar" })
  expect(all).toBeChecked()
  const asosiy = await within(sheet).findByRole("checkbox", { name: "Asosiy" })
  expect(asosiy).toBeChecked()
  expect(disabled(asosiy)).toBe(true)
  // Turned off, every location is still chosen: the ones to leave out are taken away.
  await user.click(all)
  expect(disabled(asosiy)).toBe(false)
  expect(within(sheet).getByRole("checkbox", { name: "Chilonzor" })).toBeChecked()
  await user.click(asosiy)
  await user.click(within(sheet).getByRole("checkbox", { name: "Chilonzor" }))
  // Nothing chosen: refused in the API's words, before anything is sent.
  await user.click(within(sheet).getByRole("button", { name: "Saqlash" }))
  expect(await within(sheet).findByText("Kamida bitta lokatsiyani tanlang")).toBeInTheDocument()
  await user.click(within(sheet).getByRole("checkbox", { name: "Chilonzor" }))
  await user.click(within(sheet).getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(locationIdsOf()).toEqual([chilonzor.id]))
  expect((await screen.findAllByText("Lokatsiyalar o'zgartirildi")).length).toBeGreaterThan(0)
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  unmount()

  renderWithProviders(<Opened companyId={1} employee={vali()} />)
  const again = await screen.findByRole("dialog", { name: "Lokatsiyalarni o'zgartirish" })
  expect(within(again).getByRole("switch", { name: "Barcha lokatsiyalar" })).not.toBeChecked()
  expect(await within(again).findByRole("checkbox", { name: "Chilonzor" })).toBeChecked()
  expect(within(again).getByRole("checkbox", { name: "Asosiy" })).not.toBeChecked()
  await user.click(within(again).getByRole("switch", { name: "Barcha lokatsiyalar" }))
  await user.click(within(again).getByRole("button", { name: "Saqlash" }))
  await waitFor(() => expect(locationIdsOf()).toBeUndefined())
})

test("the sheet warns of the orders the employee is assigned in the locations left out: saving is still allowed", async () => {
  addLocation(1, "Chilonzor")
  await signIn(ALI)
  const seeded = seedOrders()
  // Vali is assigned "Qo'ng'iroq qilish" already; "Shartnoma yuborish" too, both in Asosiy.
  seeded.contract.assignee = VALI
  seeded.contract.assigneeName = "Vali Aliyev"
  const { user } = renderWithProviders(<Opened companyId={1} employee={vali()} />)

  const sheet = await screen.findByRole("dialog", { name: "Lokatsiyalarni o'zgartirish" })
  await user.click(within(sheet).getByRole("switch", { name: "Barcha lokatsiyalar" }))
  await user.click(await within(sheet).findByRole("checkbox", { name: "Asosiy" }))
  expect(await within(sheet).findByText("Boshqa lokatsiyalarda 2 ta vazifaga mas'ul. Saqlash baribir mumkin.")).toBeInTheDocument()

  await user.click(within(sheet).getByRole("checkbox", { name: "Asosiy" }))
  await waitFor(() => expect(within(sheet).queryByText(/Boshqa lokatsiyalarda/)).not.toBeInTheDocument())
})
