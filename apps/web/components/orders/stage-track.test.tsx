import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { StageTrack } from "./stage-track"

const stages = [
  { id: 1, name: "Yangi", color: "blue" as const, is_done: false },
  { id: 2, name: "Bajarildi", color: "green" as const, is_done: true },
]

test("the track is frosted glass, its stages' buttons 18px round in it", () => {
  render(<StageTrack stages={stages} value={1} disabled={false} onChange={() => {}} />)
  const track = screen.getByRole("radiogroup", { name: "Bosqich" })
  expect(track).toHaveClass("surface", "rounded-[22px]")
  expect(track).not.toHaveClass("bg-card")
  expect(screen.getByRole("radio", { name: "Yangi" })).toHaveClass("rounded-[18px]")
})
