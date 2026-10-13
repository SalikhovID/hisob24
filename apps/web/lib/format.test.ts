import { expect, test } from "vitest"
import { compactAmount, dayOf, dayTitle, formatAmount, formatDate, formatDateTime, formatMoney, formatQuantity, formatRate, formatTime, unitLabel } from "./format"

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

test("formatTime writes a moment's time of day as hh:mm, in the app's time zone: the day is said by its group", () => {
  expect(formatTime("2026-10-01T20:05:00Z")).toBe("01:05")
  expect(formatTime("2026-10-02T14:11:24.053345+05:00")).toBe("14:11")
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

test("formatQuantity writes a quantity with its unit, the decimals without the trailing zeros", () => {
  expect(formatQuantity("12.000", "dona")).toBe("12 dona")
  expect(formatQuantity("1.500", "kg")).toBe("1,5 kg")
  expect(formatQuantity("0.125", "l")).toBe("0,125 l")
  expect(formatQuantity("1200.000", "m2")).toBe("1 200 m²")
  expect(formatQuantity("0.000", "kg")).toBe("0 kg")
  expect(formatQuantity("3.000", null)).toBe("3")
})

test("formatMoney writes an amount with its currency's symbol after it", () => {
  expect(formatMoney("1200000.00", { symbol: "so'm" })).toBe("1 200 000 so'm")
  expect(formatMoney("150.50", { symbol: "$" })).toBe("150,50 $")
})

test("formatRate writes a rate without its trailing zeros", () => {
  expect(formatRate("12800.0000")).toBe("12 800")
  expect(formatRate("12800.5000")).toBe("12 800,5")
  expect(formatRate("0.1234")).toBe("0,1234")
})

test("a compact amount is millions to two decimals where they matter, a smaller one grouped whole", () => {
  // Apart by a no-break space, as formatAmount writes the thousands.
  expect(compactAmount("4600000.00")).toBe("4,6\u00a0mln")
  expect(compactAmount("1234567.89")).toBe("1,23\u00a0mln")
  expect(compactAmount("12000000.00")).toBe("12\u00a0mln")
  expect(compactAmount("750000.50")).toBe(formatAmount("750000"))
  expect(compactAmount("0.00")).toBe("0")
})

test("a day is headed as people say it: today, yesterday, or the day and month with the weekday", () => {
  expect(dayTitle("2026-10-08", "2026-10-08")).toBe("Bugun")
  expect(dayTitle("2026-10-07", "2026-10-08")).toBe("Kecha")
  expect(dayTitle("2026-10-01", "2026-10-08")).toBe("1-oktabr, payshanba")
  expect(dayTitle("2026-09-28", "2026-10-08")).toBe("28-sentabr, dushanba")
  // A day after today is said by its date too.
  expect(dayTitle("2026-10-09", "2026-10-08")).toBe("9-oktabr, juma")
})

test("a moment's day is the day it is in the browser's time zone", () => {
  const moment = new Date(2026, 9, 5, 23, 30)
  expect(dayOf(moment.toISOString())).toBe("2026-10-05")
})
