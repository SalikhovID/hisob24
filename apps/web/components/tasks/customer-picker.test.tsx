import { screen, waitFor, within } from "@testing-library/react"
import { http } from "msw"
import { useForm } from "react-hook-form"
import { expect, test, vi } from "vitest"
import type { Customer } from "@/lib/types"
import { ALI, db, nextId, seedCustomers, typesOf } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { server } from "@/test/server"
import { signIn } from "@/test/session"
import { CustomerPicker } from "./customer-picker"

// Host is a form with the picker in it, as the task form has.
function Host({ onSelect, onSubmit }: { onSelect: (customer: Customer) => void; onSubmit: () => void }) {
  const form = useForm<{ customer: { phone: string } }>({ defaultValues: { customer: { phone: "" } } })
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <CustomerPicker control={form.control} name="customer.phone" companyId={1} types={typesOf(1)} onSelect={onSelect} />
      <button type="submit">Yuborish</button>
    </form>
  )
}

// asked records the digits each request for suggestions carried.
function watchSuggestions() {
  const asked: (string | null)[] = []
  server.use(
    http.get("*/api/app/customers", ({ request }) => {
      asked.push(new URL(request.url).searchParams.get("phone"))
      // Falls through to the mock API's own answer.
      return undefined
    }),
  )
  return asked
}

// moreOf enters n customers whose phones begin with 998 90 111 22.
function moreOf(n: number) {
  const { dilshod } = seedCustomers()
  for (let i = 0; i < n; i += 1) {
    db.customers.push({ ...dilshod, id: nextId(), phone: `99890111220${i}`, values: { [typesOf(1)[0].fields[0].id]: `Mijoz ${i}` } })
  }
}

const options = () =>
  within(screen.getByRole("listbox", { name: "Mijoz takliflari" }))
    .getAllByRole("option")
    .map((option) => option.textContent)

test("nothing is suggested until three digits are typed; then the customers whose phones begin with them, five at most", async () => {
  await signIn(ALI)
  moreOf(6)
  const asked = watchSuggestions()
  const { user } = renderWithProviders(<Host onSelect={vi.fn()} onSubmit={vi.fn()} />)
  const box = screen.getByRole("combobox", { name: "Telefon raqami" })
  expect(box).toHaveAttribute("aria-expanded", "false")

  await user.type(box, "90")
  await new Promise((resolve) => setTimeout(resolve, 400))
  expect(asked).toEqual([])
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument()

  await user.type(box, "1")

  await waitFor(() => expect(asked).toEqual(["901"]))
  expect(box).toHaveAttribute("aria-expanded", "true")
  // Each suggestion: the name (or the phone), the phone and the type.
  expect(options()).toHaveLength(5)
  expect(options()[0]).toContain("Mijoz 5")
  expect(options()[0]).toContain("+998 90 111 22 05")
  expect(options()[0]).toContain("Jismoniy")
  expect(box).toHaveValue("90 1")

  // More digits narrow the suggestions; a number nobody has offers nothing.
  await user.type(box, "1122")
  await waitFor(() => expect(options()).toHaveLength(5))
  await user.type(box, "9")
  await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument())
  expect(asked.at(-1)).toBe("90111229")
})

test("the arrow keys walk the suggestions, Enter takes one without sending the form, Escape closes them", async () => {
  await signIn(ALI)
  const { dilshod } = seedCustomers()
  // Another customer whose phone begins as Dilshod's does, entered later.
  db.customers.push({ ...dilshod, id: nextId(), phone: "998911119999", values: { [typesOf(1)[0].fields[0].id]: "Boshqa" } })
  const onSelect = vi.fn()
  const onSubmit = vi.fn()
  const { user } = renderWithProviders(<Host onSelect={onSelect} onSubmit={onSubmit} />)
  const box = screen.getByRole("combobox", { name: "Telefon raqami" })

  await user.type(box, "911")
  await waitFor(() => expect(screen.getByRole("listbox", { name: "Mijoz takliflari" })).toBeInTheDocument())
  expect(options()).toHaveLength(2)
  expect(box).not.toHaveAttribute("aria-activedescendant")

  await user.keyboard("{ArrowDown}")
  const [first, second] = within(screen.getByRole("listbox")).getAllByRole("option")
  expect(first).toHaveAttribute("aria-selected", "true")
  expect(box).toHaveAttribute("aria-activedescendant", first.id)
  await user.keyboard("{ArrowDown}")
  expect(second).toHaveAttribute("aria-selected", "true")
  expect(first).toHaveAttribute("aria-selected", "false")
  await user.keyboard("{ArrowUp}")
  expect(first).toHaveAttribute("aria-selected", "true")

  await user.keyboard("{Escape}")
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
  expect(box).toHaveAttribute("aria-expanded", "false")

  await user.keyboard("{ArrowDown}")
  await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument())
  await user.keyboard("{ArrowDown}{Enter}")
  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: dilshod.id, phone: dilshod.phone }))
  expect(onSubmit).not.toHaveBeenCalled()
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
})

test("a click takes a suggestion; the suggestions are not in the way of a form sent with Enter from a closed box", async () => {
  await signIn(ALI)
  const { malika } = seedCustomers()
  const onSelect = vi.fn()
  const onSubmit = vi.fn()
  const { user } = renderWithProviders(<Host onSelect={onSelect} onSubmit={onSubmit} />)
  const box = screen.getByRole("combobox", { name: "Telefon raqami" })

  await user.type(box, "955")
  await user.click(await screen.findByRole("option", { name: /Malika Yusupova/ }))

  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: malika.id }))
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument()

  await user.clear(box)
  await user.type(box, "901112233{Enter}")
  expect(onSubmit).toHaveBeenCalled()
})
