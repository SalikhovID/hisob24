import { expect, test } from "vitest"
import { accessToken, clearSession, setAccessToken } from "./session"

test("there is no access token until one is set", () => {
  expect(accessToken()).toBeNull()

  setAccessToken("access:998901234567:1:1")

  expect(accessToken()).toBe("access:998901234567:1:1")
})

test("clearSession forgets the access token", () => {
  setAccessToken("access:998901234567:1:1")
  expect(accessToken()).toBe("access:998901234567:1:1")

  clearSession()

  expect(accessToken()).toBeNull()
})
