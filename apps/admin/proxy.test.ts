// @vitest-environment node
import { getRedirectUrl } from "next/experimental/testing/server"
import { NextRequest } from "next/server"
import { expect, test } from "vitest"
import { proxy } from "./proxy"

test("proxy sends a page without a session to /login", () => {
  const response = proxy(new NextRequest("http://localhost:3001/companies"))

  expect(getRedirectUrl(response)).toBe("http://localhost:3001/login")
})

test("proxy lets a page with a session cookie through", () => {
  const request = new NextRequest("http://localhost:3001/companies", { headers: { cookie: "admin_session=abc" } })

  expect(getRedirectUrl(proxy(request))).toBeNull()
})
