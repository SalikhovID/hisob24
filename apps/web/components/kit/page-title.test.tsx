import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, test, vi } from "vitest"
import { BackLink, PageTitle, PlusButton } from "./page-title"

test("a page title names the page, says what it holds and carries its action", async () => {
  const add = vi.fn()
  render(
    <PageTitle title="Mijozlar" description="Kompaniyangiz mijozlari · 10 ta" action={<PlusButton label="Mijoz qo'shish" onClick={add} />} />,
  )
  expect(screen.getByRole("heading", { level: 1, name: "Mijozlar" })).toBeInTheDocument()
  expect(screen.getByText("Kompaniyangiz mijozlari · 10 ta")).toBeInTheDocument()
  await userEvent.click(screen.getByRole("button", { name: "Mijoz qo'shish" }))
  expect(add).toHaveBeenCalledTimes(1)
})

test("a page under another leads back to it", () => {
  render(<PageTitle title="Yangi rol" back={{ href: "/settings/roles", label: "Rollar" }} />)
  expect(screen.getByRole("link", { name: "Rollar" })).toHaveAttribute("href", "/settings/roles")
})

test("a plus button may be a link", () => {
  render(<PlusButton label="Xarid qo'shish" href="/purchases/new" />)
  expect(screen.getByRole("link", { name: "Xarid qo'shish" })).toHaveAttribute("href", "/purchases/new")
})

test("a back link's chevron is decoration", () => {
  render(<BackLink href="/" label="Bosh sahifa" />)
  expect(screen.getByRole("link", { name: "Bosh sahifa" }).querySelector("svg")).toHaveAttribute("aria-hidden", "true")
})

test("the plus is the prototype's: a 36px accent circle on a phone, on the web the accent button with its name", () => {
  render(<PlusButton label="Mijoz qo'shish" onClick={() => {}} />)
  const plus = screen.getByRole("button", { name: "Mijoz qo'shish" })
  expect(plus).toHaveClass("size-9", "rounded-full", "bg-primary", "text-primary-foreground", "md:h-8", "md:w-auto", "md:rounded-md", "md:px-3")
  expect(within(plus).getByText("Mijoz qo'shish")).toHaveClass("hidden", "md:inline")
})

test("a page's name is the prototype's: a 32px bold title on a phone, 20px semibold on the web", () => {
  render(<PageTitle title="Mijozlar" description="Kompaniyangiz mijozlari" />)
  expect(screen.getByRole("heading", { level: 1, name: "Mijozlar" })).toHaveClass("text-[32px]", "font-bold", "md:text-[20px]", "md:font-semibold")
  expect(screen.getByText("Kompaniyangiz mijozlari")).toHaveClass("text-md", "md:text-[13px]", "text-muted-foreground")
})

test("a page's title is the name alone, as the prototype's: no brand mark beside it", () => {
  const { container } = render(<PageTitle title="Mijozlar" />)
  expect(container.querySelector('[data-slot="brand-mark"]')).not.toBeInTheDocument()
})

test("the way back is the accent's words, hidden inside Telegram where its own Back button stands", () => {
  render(<BackLink href="/" label="Bosh sahifa" />)
  expect(screen.getByRole("link", { name: "Bosh sahifa" })).toHaveClass("text-accent-text", "[html[data-telegram]_&]:hidden")
})

test("on a phone a record's actions, as wide as the page, go under the title; a plus stays at its right", () => {
  render(<PageTitle title="Dilshod Karimov" action={<span data-testid="actions" />} />)

  expect(screen.getByTestId("actions").parentElement!.parentElement).toHaveClass("max-md:flex-wrap")
})

test("on a phone the record's actions under the title take the page's whole width, the tiles sharing it", () => {
  render(<PageTitle title="Dilshod Karimov" action={<div data-slot="page-actions" data-testid="actions" />} />)

  expect(screen.getByTestId("actions").parentElement).toHaveClass("max-md:has-[[data-slot=page-actions]]:w-full")
})
