// @vitest-environment node
import { getRedirectUrl, unstable_doesMiddlewareMatch } from "next/experimental/testing/server"
import { NextRequest } from "next/server"
import { expect, test } from "vitest"
import { config, proxy } from "./proxy"

test("proxy sends a page without a session to /login", () => {
  const response = proxy(new NextRequest("http://localhost:3001/companies"))

  expect(getRedirectUrl(response)).toBe("http://localhost:3001/login")
})

test("proxy lets a page with a session cookie through", () => {
  const request = new NextRequest("http://localhost:3001/companies", { headers: { cookie: "admin_session=abc" } })

  expect(getRedirectUrl(proxy(request))).toBeNull()
})

test.each([
  ["/", true],
  ["/companies", true],
  ["/companies/5", true],
  ["/admins", true],
  ["/login", false],
  ["/api/admin/me", false],
  ["/api/admin/auth/otp", false],
  ["/_next/static/chunks/app.js", false],
  ["/_next/image", false],
  ["/favicon.ico", false],
  ["/icon.svg", false],
  ["/apple-icon.png", false],
])("proxy runs on %s: %s", (url, runs) => {
  expect(unstable_doesMiddlewareMatch({ config, url })).toBe(runs)
})
