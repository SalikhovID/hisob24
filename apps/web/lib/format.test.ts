import { expect, test } from "vitest"
import { formatAmount, formatDate, formatDateTime, unitLabel } from "./format"

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

test("formatAmount writes an amount for people: thousands apart, the decimals after a comma, none when they are zero", () => {
  expect(formatAmount("1200000.00")).toBe("1\u00a0200\u00a0000")
  expect(formatAmount("150000.50")).toBe("150\u00a0000,50")
  expect(formatAmount("0.5")).toBe("0,5")
  expect(formatAmount("999")).toBe("999")
  expect(formatAmount("12000.10")).toBe("12\u00a0000,10")
})

test("unitLabel names a unit on screen: m2 as m²", () => {
  expect(unitLabel("kg")).toBe("kg")
  expect(unitLabel("m2")).toBe("m²")
})
