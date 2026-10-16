import { render, screen } from "@testing-library/react"
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

test("the plus is the prototype's glossy capsule: 56 by 42, its ends round", () => {
  render(<PlusButton label="Mijoz qo'shish" onClick={() => {}} />)
  const plus = screen.getByRole("button", { name: "Mijoz qo'shish" })
  expect(plus).toHaveClass("glossy", "h-[42px]", "w-14", "rounded-[21px]")
  expect(plus).not.toHaveClass("size-11")
  expect(plus).not.toHaveClass("bg-primary")
})

test("a page's name is the prototype's large title: 28px, drawn a little tighter; 30px on a wide screen", () => {
  render(<PageTitle title="Mijozlar" />)
  expect(screen.getByRole("heading", { level: 1, name: "Mijozlar" })).toHaveClass("text-[28px]", "tracking-[-0.025em]", "md:text-[30px]")
})

test("a page's title opens with the brand mark beside the name on a phone; on a wide screen the sidebar holds it", () => {
  const { container } = render(<PageTitle title="Mijozlar" description="Kompaniyangiz mijozlari" />)
  const mark = container.querySelector('[data-slot="page-title"] [data-slot="brand-mark"]')
  expect(mark).toBeInTheDocument()
  expect(mark).toHaveClass("md:hidden")
  // The mark stands before the name and its line, at their left.
  expect(mark?.nextElementSibling).toContainElement(screen.getByRole("heading", { level: 1, name: "Mijozlar" }))
})
