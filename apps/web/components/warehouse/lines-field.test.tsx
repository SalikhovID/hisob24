import { screen, within } from "@testing-library/react"
import { useForm } from "react-hook-form"
import { expect, test } from "vitest"
import { emptyLine, type LineForm } from "@/lib/warehouse"
import { ALI, seedCatalog, seedWarehouse, VALI } from "@/mocks/data"
import { pick } from "@/test/pick"
import { renderWithProviders } from "@/test/render"
import { chooseCompany, signIn } from "@/test/session"
import { LinesField } from "./lines-field"

// Host is a form of lines alone, as the documents' forms hold them; items
// are the lines it comes with (one empty unless told).
function Host({ withPrice, currencyId = 1, items = [emptyLine()] }: { withPrice: boolean; currencyId?: number; items?: LineForm[] }) {
  const form = useForm<{ items: LineForm[] }>({ defaultValues: { items } })
  return (
    <form>
      <LinesField form={form} companyId={1} withPrice={withPrice} currencyId={currencyId} pending={false} />
    </form>
  )
}

const line = (n: number) => screen.getByRole("group", { name: `${n}-qator` })
const price = (n: number) => within(line(n)).getByLabelText("Narx")

test("with prices: a product found by name, its unit at the quantity, the last price offered, the line and the total summed; lines added and taken away", async () => {
  seedWarehouse(seedCatalog())
  await signIn(ALI)
  const { user } = renderWithProviders(<Host withPrice />)

  expect(screen.getByRole("heading", { level: 2, name: "Mahsulotlar" })).toBeInTheDocument()
  const first = line(1)
  await pick(user, first, "Mahsulot", "ol", /Olma/)
  expect(within(first).getByLabelText("Narx")).toHaveValue("1 000,00")
  expect(within(first).getByText("kg")).toBeInTheDocument()
  await user.type(within(first).getByLabelText("Miqdor"), "2")
  expect(within(first).getByText("2 000")).toBeInTheDocument()
  expect(screen.getByText("2 000 so'm")).toBeInTheDocument()

  await user.click(screen.getByRole("button", { name: "Qator qo'shish" }))
  const second = line(2)
  await pick(user, second, "Mahsulot", "n", /Nok/)
  await user.type(within(second).getByLabelText("Miqdor"), "3")
  expect(within(second).getByText("7 501,5")).toBeInTheDocument()
  expect(screen.getByText("9 501,5 so'm")).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "1-qatorni olib tashlash" }))
  expect(screen.queryByRole("group", { name: "2-qator" })).not.toBeInTheDocument()
  expect(within(line(1)).getByText("Nok")).toBeInTheDocument()
  expect(screen.getByText("7 501,5 so'm")).toBeInTheDocument()
})

test("without prices: the product and its quantity alone, no price, no sum", async () => {
  seedWarehouse(seedCatalog())
  await signIn(ALI)
  const { user } = renderWithProviders(<Host withPrice={false} />)

  const first = line(1)
  await pick(user, first, "Mahsulot", "ol", /Olma/)
  expect(within(first).queryByLabelText("Narx")).not.toBeInTheDocument()
  expect(within(first).queryByText("Summa")).not.toBeInTheDocument()
  expect(screen.queryByText("Jami")).not.toBeInTheDocument()
  await user.type(within(first).getByLabelText("Miqdor"), "4")
  expect(within(first).getByLabelText("Miqdor")).toHaveValue("4")
  expect(within(first).getByText("kg")).toBeInTheDocument()
})

test("the lines are the prototype's cards: the heading counts them, a lone line is not taken away, a product of another line is not taken twice", async () => {
  const catalog = seedCatalog()
  seedWarehouse(catalog)
  await signIn(ALI)
  const { user } = renderWithProviders(<Host withPrice />)

  expect(screen.getByRole("heading", { level: 2, name: "Mahsulotlar" }).parentElement).toHaveTextContent("1 qator")
  expect(line(1)).toHaveAttribute("data-slot", "line-card")
  expect(screen.queryByRole("button", { name: "1-qatorni olib tashlash" })).not.toBeInTheDocument()
  await pick(user, line(1), "Mahsulot", "ol", /Olma/)

  await user.click(screen.getByRole("button", { name: "Qator qo'shish" }))
  expect(screen.getByRole("heading", { level: 2, name: "Mahsulotlar" }).parentElement).toHaveTextContent("2 qator")
  expect(screen.getByRole("button", { name: "1-qatorni olib tashlash" })).toBeInTheDocument()
  await user.click(within(line(2)).getByRole("button", { name: /^Mahsulot/ }))
  const sheet = await screen.findByRole("dialog", { name: "Mahsulot" })
  const olma = await within(sheet).findByRole("option", { name: /Olma/ })
  expect(olma).toHaveAttribute("aria-disabled", "true")
})

test("a line is the prototype's card of frosted glass, 24px round; the total stands on the same glass", async () => {
  const catalog = seedCatalog()
  seedWarehouse(catalog)
  await signIn(ALI)
  renderWithProviders(<Host withPrice />)

  expect(line(1)).toHaveClass("surface", "rounded-[24px]")
  expect(line(1)).not.toHaveClass("bg-card")
  expect(screen.getByText("Jami").parentElement).toHaveClass("surface")
})

test("the quantity and the price of a line are typed in boxes with an edge, the unit inside the box: a bare number is no field", async () => {
  seedWarehouse(seedCatalog())
  await signIn(ALI)
  const { user } = renderWithProviders(<Host withPrice />)
  await pick(user, line(1), "Mahsulot", "ol", /Olma/)

  for (const [name, unit] of [
    ["Miqdor", "kg"],
    ["Narx", "so'm"],
  ] as const) {
    const box = within(line(1)).getByLabelText(name).closest<HTMLElement>('[data-slot="field-box"]')
    expect(box, name).toBeInTheDocument()
    expect(box, name).toHaveClass("shadow-[inset_0_0_0_1px_var(--ink-5)]", "md:shadow-[inset_0_0_0_1px_var(--ink-4)]")
    expect(within(box!).getByText(unit), name).toBeInTheDocument()
  }
})

test("the prices follow the document's currency: each one, typed or offered, is turned by the rates in force when it changes; what is no price stays as typed", async () => {
  await signIn(VALI)
  await chooseCompany(2)
  const { user, rerender } = renderWithProviders(<Host withPrice currencyId={1} />)

  await user.type(price(1), "1 920 000")
  await user.click(screen.getByRole("button", { name: "Qator qo'shish" }))
  await user.type(price(2), "6400")
  await user.click(screen.getByRole("button", { name: "Qator qo'shish" }))
  // Letters cannot be typed in a price (the mask drops them); three decimals
  // are no price either.
  await user.type(price(3), "1,234")
  await user.click(screen.getByRole("button", { name: "Qator qo'shish" }))

  rerender(<Host withPrice currencyId={2} />)
  expect(price(1)).toHaveValue("150,00")
  expect(price(2)).toHaveValue("0,50")
  expect(price(3)).toHaveValue("1,234")
  expect(price(4)).toHaveValue("")

  rerender(<Host withPrice currencyId={1} />)
  expect(price(1)).toHaveValue("1 920 000,00")
  expect(price(2)).toHaveValue("6 400,00")
})

test("a document opened in its own currency keeps its prices; only a change of the currency turns them", async () => {
  await signIn(VALI)
  await chooseCompany(2)
  const items = [{ ...emptyLine(), price: "150.00" }]
  const { rerender } = renderWithProviders(<Host withPrice currencyId={2} items={items} />)

  expect(await within(line(1)).findByText("$")).toBeInTheDocument()
  expect(price(1)).toHaveValue("150,00")
  rerender(<Host withPrice currencyId={1} items={items} />)
  expect(price(1)).toHaveValue("1 920 000,00")
})

test("a price typed in a line is masked as an amount; the quantity beside it is left as typed", async () => {
  seedWarehouse(seedCatalog())
  await signIn(ALI)
  const { user } = renderWithProviders(<Host withPrice />)

  await user.type(price(1), "1250000.5")
  expect(price(1)).toHaveValue("1 250 000,5")
  await user.type(within(line(1)).getByLabelText("Miqdor"), "1500")
  expect(within(line(1)).getByLabelText("Miqdor")).toHaveValue("1500")
})
