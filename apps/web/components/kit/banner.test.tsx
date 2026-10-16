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

test("the banner is the prototype's: its own gradient and ink, the line under in its own color, the art in the theme's own tile, ink and sparks", () => {
  render(<HomeBanner onAdd={() => {}} onDismiss={() => {}} />)
  const banner = screen.getByText("Hisob24'ni bosh ekranga qo'shing").closest('[data-slot="home-banner"]')!
  expect(banner).toHaveClass("bg-(image:--ban)", "text-(--ban-ink)", "shadow-[var(--rim),var(--lift)]")
  expect(banner).not.toHaveClass("bg-brand-panel")
  expect(screen.getByText("Bir bosishda ochiladi")).toHaveClass("text-(--ban-sub)", "font-semibold")
  const art = banner.querySelector("svg[data-slot='banner-art']")!
  const tile = art.querySelectorAll("linearGradient")[0]
  const [from, to] = tile.querySelectorAll("stop")
  expect(from).toHaveClass("[stop-color:var(--art1)]")
  expect(to).toHaveClass("[stop-color:var(--art2)]")
  expect(art.querySelector("text")).toHaveClass("fill-(--art-ink)")
  for (const spark of art.querySelectorAll("path, circle")) expect(spark).toHaveClass("fill-(--art-spark)")
  // The tile's shadow is a plain black, faint.
  expect(art.querySelector("rect")).toHaveAttribute("fill", "#000")
  expect(art.querySelector("rect")).toHaveAttribute("opacity", ".18")
})
