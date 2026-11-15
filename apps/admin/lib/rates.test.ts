import { expect, test } from "vitest"
import { RATE_SOURCES, rateSourceName, roundingName, roundingOf } from "./rates"

test("the sources by name, the central bank first and by hand last", () => {
  expect(RATE_SOURCES.map((s) => [s.value, s.label])).toEqual([
    ["cbu", "Markaziy bank"],
    ["kapitalbank", "Kapitalbank"],
    ["ipakyuli", "Ipak Yo'li banki"],
    ["asaka", "Asakabank"],
    ["hamkor", "Hamkorbank"],
    ["uzum", "Uzum Bank"],
    ["ofb", "Orient Finans Bank"],
    ["manual", "Qo'lda"],
  ])
  expect(rateSourceName("cbu")).toBe("Markaziy bank")
  expect(rateSourceName("manual")).toBe("Qo'lda")
})

test("a step as the select offers it: 1 keeps the bank's rate", () => {
  expect(roundingName(1)).toBe("Yaxlitlanmaydi")
  expect(roundingName(10)).toBe("10 so'm")
  expect(roundingName(100)).toBe("100 so'm")
  expect(roundingName(1000)).toBe("1 000 so'm")
})

test("how a company's rates are rounded: the dollar and the euro, nothing by hand", () => {
  expect(roundingOf("cbu", 100)).toBe("100 so'mgacha · USD, EUR")
  expect(roundingOf("kapitalbank", 1000)).toBe("1 000 so'mgacha · USD, EUR")
  expect(roundingOf("cbu", 1)).toBe("Yaxlitlanmaydi")
  expect(roundingOf("manual", 100)).toBe("—")
})
