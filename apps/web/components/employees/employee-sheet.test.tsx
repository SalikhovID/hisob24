import { screen, waitFor, within } from "@testing-library/react"
import { type ComponentProps, useState } from "react"
import { expect, test } from "vitest"
import { ALI, membersOf, SARDOR, VALI } from "@/mocks/data"
import { addLocation, restrictTo } from "@/test/locations"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import { EmployeeSheet } from "./employee-sheet"

// Opened is the sheet as the list opens it: open from the start, closed when it says so.
function Opened(props: Omit<ComponentProps<typeof EmployeeSheet>, "open" | "onOpenChange">) {
  const [open, setOpen] = useState(true)
  return <EmployeeSheet {...props} open={open} onOpenChange={setOpen} />
}

const member = (phone: string) => membersOf(1).find((m) => m.phone === phone)!
const everything = { rename: true, remove: true, role: true, locations: true }
const nothing = { rename: false, remove: false, role: false, locations: false }
// facts reads the sheet's facts: each name with its value.
const facts = (scope: HTMLElement) => Object.fromEntries(Array.from(scope.querySelectorAll("dt"), (dt) => [dt.textContent, dt.nextElementSibling?.textContent]))

test("an employee's sheet, as the prototype's: the head (avatar, name, phone, role), rows that change the name, the role and the locations, when they joined, the way to remove them", async () => {
  addLocation(1, "Chilonzor")
  await signIn(ALI)
  const { user } = renderWithProviders(<Opened companyId={1} companyName="Olma Savdo" employee={member(VALI)} you={false} can={everything} severalLocations />)

  const sheet = await screen.findByRole("dialog", { name: "Xodim" })
  expect(within(sheet).getByRole("heading", { level: 2, name: "Vali Aliyev" })).toBeInTheDocument()
  expect(within(sheet).getByText("+998 90 222 33 44")).toBeInTheDocument()
  expect(within(sheet).getByText("Xodim", { selector: "[data-role]" })).toBeInTheDocument()
  expect(within(sheet).queryByText("Siz")).not.toBeInTheDocument()
  expect(within(sheet).getByRole("button", { name: /^Ism/ })).toHaveTextContent("Vali Aliyev")
  expect(within(sheet).getByRole("button", { name: /^Rol/ })).toHaveTextContent("Rolsiz")
  expect(within(sheet).getByRole("button", { name: /^Lokatsiyalar/ })).toHaveTextContent("Barchasi")
  expect(facts(sheet)).toEqual({ "Qo'shilgan": expect.stringMatching(/^\d{2}\.\d{2}\.\d{4}$/) })

  // Each row opens its own sheet over this one.
  for (const [row, opened] of [
    [/^Ism/, "Ismni o'zgartirish"],
    [/^Rol/, "Rolni o'zgartirish"],
    [/^Lokatsiyalar/, "Lokatsiyalarni o'zgartirish"],
  ] as const) {
    await user.click(within(sheet).getByRole("button", { name: row }))
    expect(await screen.findByRole("dialog", { name: opened })).toBeInTheDocument()
    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog", { name: opened })).not.toBeInTheDocument())
  }
  await user.click(within(sheet).getByRole("button", { name: "Xodimni o'chirish" }))
  expect(await screen.findByRole("alertdialog", { name: "Xodimni o'chirasizmi?" })).toBeInTheDocument()
})

test("the owner's sheet says who they are and why nothing changes here", async () => {
  addLocation(1, "Chilonzor")
  await signIn(ALI)
  renderWithProviders(<Opened companyId={1} companyName="Olma Savdo" employee={member(ALI)} you can={everything} severalLocations />)

  const sheet = await screen.findByRole("dialog", { name: "Xodim" })
  expect(within(sheet).getByRole("heading", { level: 2, name: "Ali Valiyev" })).toBeInTheDocument()
  expect(within(sheet).getByText("Egasi", { selector: "[data-role]" })).toBeInTheDocument()
  expect(within(sheet).getByText("Siz")).toBeInTheDocument()
  expect(facts(sheet)).toEqual({ Rol: "Egasi", Lokatsiyalar: "Barchasi", "Qo'shilgan": expect.any(String) })
  expect(within(sheet).getByText("Kompaniya egasini o'zgartirib yoki o'chirib bo'lmaydi. Egasini faqat platforma administratori almashtiradi.")).toBeInTheDocument()
  expect(within(sheet).queryByRole("button", { name: /^(Ism|Rol|Lokatsiyalar|Xodimni o'chirish)/ })).not.toBeInTheDocument()
})

test("whoever may only see the employees sees the facts, the locations among them (none: a dash), and no way to change anything", async () => {
  const chilonzor = addLocation(1, "Chilonzor")
  restrictTo(SARDOR, 1, [chilonzor.id])
  await signIn(ALI)
  const { unmount } = renderWithProviders(<Opened companyId={1} companyName="Olma Savdo" employee={member(SARDOR)} you={false} can={nothing} severalLocations />)

  const sheet = await screen.findByRole("dialog", { name: "Xodim" })
  expect(facts(sheet)).toEqual({ Lokatsiyalar: "Chilonzor", "Qo'shilgan": expect.any(String) })
  expect(within(sheet).queryByRole("button", { name: /^(Ism|Rol|Lokatsiyalar|Xodimni o'chirish)/ })).not.toBeInTheDocument()
  unmount()

  restrictTo(SARDOR, 1, [])
  renderWithProviders(<Opened companyId={1} companyName="Olma Savdo" employee={member(SARDOR)} you={false} can={nothing} severalLocations />)
  expect(facts(await screen.findByRole("dialog", { name: "Xodim" }))).toMatchObject({ Lokatsiyalar: "—" })
})

test("with one location the sheet says nothing of locations", async () => {
  await signIn(ALI)
  renderWithProviders(<Opened companyId={1} companyName="Olma Savdo" employee={member(VALI)} you={false} can={everything} severalLocations={false} />)

  const sheet = await screen.findByRole("dialog", { name: "Xodim" })
  expect(within(sheet).queryByRole("button", { name: /^Lokatsiyalar/ })).not.toBeInTheDocument()
  expect(facts(sheet)).not.toHaveProperty("Lokatsiyalar")
})
