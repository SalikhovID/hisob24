import { expect, test } from "vitest"
import { formatAmount, formatDate, formatPhone } from "./format"

test("formatDate writes a date as dd.mm.yyyy", () => {
  expect(formatDate("2026-10-07")).toBe("07.10.2026")
})

test("formatDate shows a timestamp's day in the panel's time zone", () => {
  // 20:30 UTC is already the next day in Tashkent (UTC+5).
  expect(formatDate("2026-10-01T20:30:00Z")).toBe("02.10.2026")
  expect(formatDate("2026-10-02T14:11:24.053345+05:00")).toBe("02.10.2026")
})

test("formatPhone groups an Uzbek number", () => {
  expect(formatPhone("998901234567")).toBe("+998 90 123 45 67")
})

test("formatPhone keeps any other number whole", () => {
  expect(formatPhone("79161234567")).toBe("+79161234567")
})

test("formatAmount groups thousands and keeps the stored decimals", () => {
  expect(formatAmount("150000.50")).toBe("150\u00a0000,50")
  expect(formatAmount("100.00")).toBe("100,00")
  expect(formatAmount("1234567")).toBe("1\u00a0234\u00a0567")
})

test("formatAmount shows a dash when there is no amount", () => {
  expect(formatAmount(null)).toBe("—")
})
