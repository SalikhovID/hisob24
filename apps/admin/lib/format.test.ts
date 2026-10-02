import { expect, test } from "vitest"
import { formatDate } from "./format"

test("formatDate writes a date as dd.mm.yyyy", () => {
  expect(formatDate("2026-10-07")).toBe("07.10.2026")
})
