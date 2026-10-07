// @vitest-environment node
import { getRedirectUrl, unstable_doesMiddlewareMatch } from "next/experimental/testing/server"
import { NextRequest } from "next/server"
import { expect, test } from "vitest"
import { config, proxy } from "./proxy"

test.each(["/", "/customers", "/customers/7", "/tasks", "/tasks/7", "/products", "/products/7", "/services", "/suppliers", "/suppliers/3", "/purchases", "/purchases/new", "/purchases/3", "/purchases/3/edit", "/employees", "/settings", "/settings/customer-types/7", "/select-company", "/expired"])("proxy sends %s without a session to /login", (path) => {
  const response = proxy(new NextRequest(`http://localhost:3000${path}`))

  expect(getRedirectUrl(response)).toBe("http://localhost:3000/login")
})

test("proxy lets a page with a refresh cookie through", () => {
  const request = new NextRequest("http://localhost:3000/", { headers: { cookie: "refresh_token=abc" } })

  expect(getRedirectUrl(proxy(request))).toBeNull()
})

test.each([
  ["/", true],
  ["/employees", true],
  ["/customers", true],
  ["/customers/7?tab=1", true],
  ["/tasks?view=board", true],
  ["/tasks/7", true],
  ["/products", true],
  ["/products/7", true],
  ["/services?status=inactive", true],
  ["/suppliers", true],
  ["/suppliers/3", true],
  ["/purchases?page=2", true],
  ["/purchases/new", true],
  ["/purchases/3", true],
  ["/purchases/3/edit", true],
  ["/settings", true],
  ["/settings/dropdowns/7", true],
  ["/select-company", true],
  ["/expired", true],
  ["/login", false],
  ["/api/app/me", false],
  ["/api/app/auth/refresh", false],
  ["/_next/static/chunks/app.js", false],
  ["/_next/image", false],
  ["/favicon.ico", false],
  ["/icon.svg", false],
  ["/apple-icon.png", false],
])("proxy runs on %s: %s", (url, runs) => {
  expect(unstable_doesMiddlewareMatch({ config, url })).toBe(runs)
})
