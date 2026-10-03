// @vitest-environment node
import { getRedirectUrl, unstable_doesMiddlewareMatch } from "next/experimental/testing/server"
import { NextRequest } from "next/server"
import { expect, test } from "vitest"
import { config, proxy } from "./proxy"

test.each(["/", "/employees", "/select-company", "/expired"])("proxy sends %s without a session to /login", (path) => {
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
  ["/select-company", true],
  ["/expired", true],
  ["/login", false],
  ["/api/app/me", false],
  ["/api/app/auth/refresh", false],
  ["/_next/static/chunks/app.js", false],
  ["/_next/image", false],
  ["/favicon.ico", false],
])("proxy runs on %s: %s", (url, runs) => {
  expect(unstable_doesMiddlewareMatch({ config, url })).toBe(runs)
})
