import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { expect, test } from "vitest"
import { ALI, VALI } from "@/mocks/data"
import { router } from "@/test/navigation"
import { giveRole } from "@/test/roles"
import { chooseCompany, signIn } from "@/test/session"
import { useOwner, usePermission } from "./use-gate"

// A hook under a query client, as a page has one.
function renderGate<T>(hook: () => T) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  return renderHook(hook, { wrapper })
}

test("the owner passes every gate", async () => {
  await signIn(ALI)
  const { result } = renderGate(() => ({ owner: useOwner(), settings: usePermission("settings.view") }))

  await waitFor(() => expect(result.current.owner).not.toBeNull())
  expect(result.current.owner?.company.name).toBe("Olma Savdo")
  expect(result.current.owner?.user.phone).toBe(ALI)
  expect(result.current.settings?.permissions).toContain("settings.view")
  expect(router.replace).not.toHaveBeenCalled()
})

test("an employee with a role passes the gate of a permission the role holds, and is sent home from the others", async () => {
  giveRole(VALI, 1, "Kuzatuvchi", ["customers.view", "settings.view"])
  await signIn(VALI)
  await chooseCompany(1)
  const { result } = renderGate(() => ({ settings: usePermission("settings.view"), employees: usePermission("employees.view") }))

  await waitFor(() => expect(result.current.settings).not.toBeNull())
  expect(result.current.settings?.permissions).toEqual(["customers.view", "settings.view"])
  expect(result.current.employees).toBeNull()
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"))
})

test("an employee is no owner: the owner's gate sends them home", async () => {
  await signIn(VALI)
  await chooseCompany(1)
  const { result } = renderGate(() => useOwner())

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"))
  expect(result.current).toBeNull()
})

test("before the session is known the gate gives nothing and sends nobody anywhere", async () => {
  await signIn(VALI)
  const { result } = renderGate(() => usePermission("customers.view"))

  expect(result.current).toBeNull()
  // With no company chosen there is nothing to be let into, and nothing to be sent away from.
  await new Promise((resolve) => setTimeout(resolve, 50))
  expect(result.current).toBeNull()
  expect(router.replace).not.toHaveBeenCalled()
})
