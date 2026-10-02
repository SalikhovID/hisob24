import { expect, test } from "vitest"
import Home from "./page"

// The companies list is the panel's home page.
test("the root page sends the admin to the companies", () => {
  expect(() => Home()).toThrow("redirect: /companies")
})
