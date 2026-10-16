import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, test, vi } from "vitest"
import { HomeBanner } from "./banner"

test("the banner offers to add the app to the home screen, and can be put away", async () => {
  const add = vi.fn()
  const dismiss = vi.fn()
  render(<HomeBanner onAdd={add} onDismiss={dismiss} />)
  await userEvent.click(screen.getByRole("button", { name: /Hisob24'ni bosh ekranga qo'shing/ }))
  expect(add).toHaveBeenCalledTimes(1)
  await userEvent.click(screen.getByRole("button", { name: "Yopish" }))
  expect(dismiss).toHaveBeenCalledTimes(1)
  expect(
    screen.getByText("Hisob24'ni bosh ekranga qo'shing").closest('[data-slot="home-banner"]')?.querySelector("svg[data-slot='banner-art']"),
  ).toHaveAttribute("aria-hidden", "true")
})

test("the banner is the prototype's: its own gradient and ink, the line under in its own color, the art lavender with gold sparks", () => {
  render(<HomeBanner onAdd={() => {}} onDismiss={() => {}} />)
  const banner = screen.getByText("Hisob24'ni bosh ekranga qo'shing").closest('[data-slot="home-banner"]')!
  expect(banner).toHaveClass("bg-(image:--ban)", "text-(--ban-ink)", "shadow-[var(--rim),var(--lift)]")
  expect(banner).not.toHaveClass("bg-brand-panel")
  expect(screen.getByText("Bir bosishda ochiladi")).toHaveClass("text-(--ban-sub)", "font-semibold")
  const art = banner.querySelector("svg[data-slot='banner-art']")!
  const tile = art.querySelectorAll("linearGradient")[0]
  expect([...tile.querySelectorAll("stop")].map((stop) => stop.getAttribute("stop-color"))).toEqual(["#A99CF8", "#5E4DCC"])
  expect([...art.querySelectorAll("path")].map((path) => path.getAttribute("fill"))).toEqual(["#D4A541", "#D4A541", "#D4A541"])
  expect(art.querySelector("circle")).toHaveAttribute("fill", "#D4A541")
})
