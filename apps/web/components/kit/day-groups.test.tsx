import { render, screen, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { DayGroups } from "./day-groups"
import { Row } from "./group"

const at = (day: number, hour: number) => new Date(2026, 9, day, hour).toISOString()

test("documents stand under their day, the newest first, each day headed as people say it with its hint", () => {
  const items = [
    { id: 3, at: at(5, 18), total: 30 },
    { id: 2, at: at(5, 9), total: 20 },
    { id: 1, at: at(1, 9), total: 10 },
  ]
  render(
    <DayGroups label="Xaridlar" items={items} at={(item) => item.at} today="2026-10-05" hint={(day) => String(day.reduce((sum, item) => sum + item.total, 0))}>
      {(item) => <Row key={item.id} title={`№ ${item.id}`} />}
    </DayGroups>,
  )

  const region = screen.getByRole("region", { name: "Xaridlar" })
  expect(within(region).getAllByRole("heading").map((heading) => heading.textContent)).toEqual(["Bugun", "1-oktabr, payshanba"])
  expect(within(within(region).getByRole("list", { name: "Bugun" })).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["№ 3", "№ 2"])
  expect(within(region).getByRole("list", { name: "1-oktabr, payshanba" })).toHaveTextContent("№ 1")
  expect(within(region).getByRole("heading", { name: "Bugun" }).parentElement).toHaveTextContent("50")
})
