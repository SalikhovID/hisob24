import { expect, test } from "vitest"
import { previewEndDate } from "./billing"

test.each([
  { name: "not expired: the days follow the end date", endDate: "2026-10-20", daysLeft: 18, days: 30, want: "2026-11-19" },
  { name: "ends today: still counts from the end date", endDate: "2026-10-02", daysLeft: 0, days: 1, want: "2026-10-03" },
])("previewEndDate: $name", ({ endDate, daysLeft, days, want }) => {
  expect(previewEndDate(endDate, daysLeft, days)).toBe(want)
})
