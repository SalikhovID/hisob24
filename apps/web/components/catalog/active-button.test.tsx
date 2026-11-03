import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { expect, test } from "vitest"
import { toProduct } from "@/mocks/catalog"
import { ALI, db, seedCatalog } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import { ActiveButton, useProductActive } from "./active-button"

// A hook under a query client, as a page has one.
function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

test("a product is turned off from its page's action, and the action says which", async () => {
  const { olma } = seedCatalog()
  await signIn(ALI)
  const { user } = renderWithProviders(<ActiveButton companyId={1} product={toProduct(olma)} />)

  const action = screen.getByRole("button", { name: "Nofaol qilish" })
  expect(action).toHaveAttribute("data-slot", "page-action")
  await user.click(action)

  await waitFor(() => expect(db.products.find((p) => p.id === olma.id)?.active).toBe(false))
  expect(await screen.findByText("Mahsulot nofaol qilindi")).toBeInTheDocument()
})

test("an inactive product's action turns it on", async () => {
  const { olma } = seedCatalog()
  olma.active = false
  await signIn(ALI)
  renderWithProviders(<ActiveButton companyId={1} product={toProduct(olma)} />)

  expect(screen.getByRole("button", { name: "Faollashtirish" })).toHaveAttribute("data-slot", "page-action")
})

test("the list's sheet turns an inactive service on with the same hook", async () => {
  const { yetkazish } = seedCatalog()
  yetkazish.active = false
  await signIn(ALI)
  const { result } = renderHook(() => useProductActive(1), { wrapper })

  result.current.mutate(toProduct(yetkazish))

  await waitFor(() => expect(db.products.find((p) => p.id === yetkazish.id)?.active).toBe(true))
})
