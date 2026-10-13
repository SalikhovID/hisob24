import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { SearchBox } from "./search-box"

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
afterEach(() => vi.useRealTimers())

test("the box reports what was typed once typing pauses, trimmed", async () => {
  const search = vi.fn()
  render(<SearchBox value="" onSearch={search} placeholder="Ism yoki telefon" />)
  const box = screen.getByRole("searchbox", { name: "Qidirish" })
  expect(box).toHaveAttribute("placeholder", "Ism yoki telefon")
  await userEvent.type(box, " ali ")
  expect(search).not.toHaveBeenCalled()
  await act(() => vi.advanceTimersByTimeAsync(300))
  expect(search).toHaveBeenCalledWith("ali")
})

test("the clear button empties the box and reports at once; it is not there while the box is empty", async () => {
  const search = vi.fn()
  render(<SearchBox value="ali" onSearch={search} />)
  expect(screen.getByRole("searchbox")).toHaveValue("ali")
  await userEvent.click(screen.getByRole("button", { name: "Tozalash" }))
  expect(search).toHaveBeenCalledWith("")
  expect(screen.getByRole("searchbox")).toHaveValue("")
  expect(screen.queryByRole("button", { name: "Tozalash" })).not.toBeInTheDocument()
})

test("a search changed from outside is shown", () => {
  const { rerender } = render(<SearchBox value="ali" onSearch={() => {}} />)
  rerender(<SearchBox value="" onSearch={() => {}} />)
  expect(screen.getByRole("searchbox")).toHaveValue("")
})

test("with no delay the box reports every keystroke (a picker's list)", async () => {
  const search = vi.fn()
  render(<SearchBox value="" onSearch={search} delay={0} />)
  await userEvent.type(screen.getByRole("searchbox"), "ol")
  expect(search).toHaveBeenLastCalledWith("ol")
})
