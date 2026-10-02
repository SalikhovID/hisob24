import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { CompanyStatusBadge } from "./status-badge"

test.each([
  [{ is_active: false, days_left: 30 }, "Bloklangan", "danger"],
  [{ is_active: true, days_left: -1 }, "Muddati o'tgan", "danger"],
  [{ is_active: true, days_left: 0 }, "Bugun tugaydi", "warning"],
  [{ is_active: true, days_left: 7 }, "7 kun qoldi", "warning"],
  [{ is_active: true, days_left: 30 }, "30 kun qoldi", "success"],
])("CompanyStatusBadge for %j says %s", (company, text, tone) => {
  render(<CompanyStatusBadge company={company} />)

  expect(screen.getByText(text)).toHaveAttribute("data-tone", tone)
})
