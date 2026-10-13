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
