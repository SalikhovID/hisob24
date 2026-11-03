import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, test } from "vitest"
import { router, setLocation } from "@/test/navigation"
import { InPageTabs } from "./in-page-tabs"

const tabs = [
  { value: "info", label: "Ma'lumot", content: <p>Telefon raqami</p> },
  { value: "orders", label: "Buyurtmalar", content: <p>Buyurtma № 2</p> },
  { value: "history", label: "Tarix", content: <p>Qo&apos;shildi</p> },
]

test("the tabs are the prototype's segmented control over the chosen one's panel, the first at first", () => {
  setLocation("/customers/1")
  render(<InPageTabs label="Mijoz" tabs={tabs} />)

  const list = screen.getByRole("tablist", { name: "Mijoz" })
  expect(list).toHaveAttribute("data-slot", "in-page-tabs")
  expect(screen.getByRole("tab", { name: "Ma'lumot" })).toHaveAttribute("aria-selected", "true")
  expect(screen.getByRole("tabpanel")).toHaveTextContent("Telefon raqami")
  expect(screen.queryByText("Buyurtma № 2")).not.toBeInTheDocument()
})

test("a tab chosen shows its panel and stays in the address, so the way back finds it; the first leaves the address bare", async () => {
  setLocation("/customers/1")
  render(<InPageTabs label="Mijoz" tabs={tabs} />)

  await userEvent.click(screen.getByRole("tab", { name: "Buyurtmalar" }))
  expect(router.replace).toHaveBeenLastCalledWith("/customers/1?tab=orders", { scroll: false })
  expect(await screen.findByRole("tabpanel")).toHaveTextContent("Buyurtma № 2")

  await userEvent.click(screen.getByRole("tab", { name: "Ma'lumot" }))
  expect(router.replace).toHaveBeenLastCalledWith("/customers/1", { scroll: false })
})

test("an address with a tab opens it; one not among them opens the first", () => {
  setLocation("/customers/1?tab=history")
  const { unmount } = render(<InPageTabs label="Mijoz" tabs={tabs} />)
  expect(screen.getByRole("tabpanel")).toHaveTextContent("Qo'shildi")
  unmount()

  setLocation("/customers/1?tab=zzz")
  render(<InPageTabs label="Mijoz" tabs={tabs} />)
  expect(screen.getByRole("tabpanel")).toHaveTextContent("Telefon raqami")
})
