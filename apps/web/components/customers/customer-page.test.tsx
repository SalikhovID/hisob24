import { screen, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, seedCustomers, seedSixKinds } from "@/mocks/data"
import { setLocation } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import { CustomerPage } from "./customer-page"

// open puts the test on a customer's page.
function open(id: number) {
  setLocation(`/customers/${id}`, { id: String(id) })
  return renderWithProviders(<CustomerPage id={id} />)
}

// pairsOf reads a list of names and values as [name, value] of each line.
const pairsOf = (region: HTMLElement) =>
  Array.from(region.querySelectorAll("dt")).map((term) => [term.textContent, term.nextElementSibling?.textContent ?? null])

const info = () => screen.findByRole("region", { name: "Ma'lumot" })

test("a customer's page shows who it is, every field of its type in order, and who entered it", async () => {
  await signIn(ALI)
  const { dilshod } = seedCustomers()
  seedSixKinds()

  open(dilshod.id)

  expect(await screen.findByRole("heading", { level: 1, name: "Dilshod Karimov" })).toBeInTheDocument()
  expect(screen.getByText("Jismoniy · +998 91 111 22 33")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Mijozlar" })).toHaveAttribute("href", "/customers")
  expect(pairsOf(await info())).toEqual([
    ["Telefon", "+998 91 111 22 33"],
    ["F.I.Sh.", "Dilshod Karimov"],
    ["Manba", "Instagram"],
    // The fields left empty are there too, with a dash.
    ["Yoshi", "—"],
    ["Jinsi", "—"],
    ["Tillar", "—"],
    ["Kanallar", "—"],
    ["Qo'shgan", "Vali Aliyev"],
    ["Qo'shilgan", "02.10.2026"],
  ])
})

test("an option that was turned off since is still the customer's answer", async () => {
  await signIn(ALI)
  const { malika } = seedCustomers()

  open(malika.id)

  expect(within(await info()).getByText("YouTube")).toBeInTheDocument()
})

test("a customer with no name goes by the phone, which is then not said again under it", async () => {
  await signIn(ALI)
  const { dilshod } = seedCustomers()
  dilshod.values = {}

  open(dilshod.id)

  expect(await screen.findByRole("heading", { level: 1, name: "+998 91 111 22 33" })).toBeInTheDocument()
  expect(screen.getByText("Jismoniy")).toBeInTheDocument()
  expect(screen.queryByText("Jismoniy · +998 91 111 22 33")).not.toBeInTheDocument()
})
