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

test("the banner is a flat card: its words in the ink, the way in in the accent's words, a plain close icon, the art a flat teal tile", () => {
  render(<HomeBanner onAdd={() => {}} onDismiss={() => {}} />)
  const banner = screen.getByText("Hisob24'ni bosh ekranga qo'shing").closest('[data-slot="home-banner"]')!
  expect(banner).toHaveClass("surface", "rounded-group", "md:rounded-lg", "text-foreground")
  expect(banner.className).not.toContain("--rim")
  expect(screen.getByText("Bir bosishda ochiladi")).toHaveClass("text-accent-text")
  expect(screen.getByRole("button", { name: "Yopish" })).toHaveClass("text-icon")
  const art = banner.querySelector("svg[data-slot='banner-art']")!
  expect(art.querySelectorAll("linearGradient")).toHaveLength(0)
  expect(art.querySelector("rect")).toHaveClass("fill-brand")
})
