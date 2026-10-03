import { expect, test } from "vitest"
import { navFor } from "./nav"
import type { Role } from "./types"

const labels = (role?: Role) => navFor(role).map((item) => item.label)

test("the owner may open every section", () => {
  expect(labels("owner")).toEqual(["Bosh sahifa", "Xodimlar"])
})

test("an employee, and a session whose role is not known yet, see no section of the owner's", () => {
  expect(labels("user")).toEqual(["Bosh sahifa"])
  expect(labels(undefined)).toEqual(["Bosh sahifa"])
})
