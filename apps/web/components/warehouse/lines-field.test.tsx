import { screen, within } from "@testing-library/react"
import { useForm } from "react-hook-form"
import { expect, test } from "vitest"
import { emptyLine, type LineForm } from "@/lib/warehouse"
import { ALI, seedCatalog, seedWarehouse } from "@/mocks/data"
import { pick } from "@/test/pick"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import { LinesField } from "./lines-field"

// Host is a form of lines alone, as the documents' forms hold them.
function Host({ withPrice, currencyId = 1 }: { withPrice: boolean; currencyId?: number }) {
  const form = useForm<{ items: LineForm[] }>({ defaultValues: { items: [emptyLine()] } })
  return (
    <form>
      <LinesField form={form} companyId={1} withPrice={withPrice} currencyId={currencyId} pending={false} />
    </form>
  )
}

const line = (n: number) => screen.getByRole("group", { name: `${n}-qator` })

test("with prices: a product found by name, its unit at the quantity, the last price offered, the line and the total summed; lines added and taken away", async () => {
  seedWarehouse(seedCatalog())
  await signIn(ALI)
  const { user } = renderWithProviders(<Host withPrice />)

  expect(screen.getByRole("heading", { level: 2, name: "Mahsulotlar" })).toBeInTheDocument()
  const first = line(1)
  await pick(user, first, "Mahsulot", "ol", /Olma/)
  expect(within(first).getByLabelText("Narx")).toHaveValue("1000.00")
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
