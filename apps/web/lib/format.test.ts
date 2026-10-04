import { expect, test } from "vitest"
import { formatDate, formatDateTime } from "./format"

test("formatDate writes a date as dd.mm.yyyy", () => {
  expect(formatDate("2026-10-07")).toBe("07.10.2026")
})

test("formatDate shows a timestamp's day in the app's time zone", () => {
  // 20:30 UTC is already the next day in Tashkent (UTC+5).
  expect(formatDate("2026-10-01T20:30:00Z")).toBe("02.10.2026")
  expect(formatDate("2026-10-02T14:11:24.053345+05:00")).toBe("02.10.2026")
})

test("formatDateTime writes a moment as dd.mm.yyyy hh:mm, in the app's time zone", () => {
  // 20:05 UTC is five past one the next morning in Tashkent (UTC+5).
  expect(formatDateTime("2026-10-01T20:05:00Z")).toBe("02.10.2026 01:05")
  expect(formatDateTime("2026-10-02T14:11:24.053345+05:00")).toBe("02.10.2026 14:11")
})
