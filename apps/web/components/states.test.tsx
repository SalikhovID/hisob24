import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, test, vi } from "vitest"
import { CalendarXIcon, UserIcon } from "lucide-react"
import { MainButton } from "@/components/kit/main-button"
import { EmptyState, Failed, ListLoading, Loading, NotFound, Splash, StateScreen } from "./states"

test("EmptyState says what is missing and what would change that, as plain text", () => {
  render(
    <EmptyState
      title="Hali xodim yo'q"
      description="Xodim qo'shsangiz, u o'z telefon raqami bilan tizimga kiradi."
    />,
  )

  expect(screen.getByText("Hali xodim yo'q")).toBeInTheDocument()
  expect(screen.getByText("Xodim qo'shsangiz, u o'z telefon raqami bilan tizimga kiradi.")).toBeInTheDocument()
  // The page's headings are its sections: this is a note inside one.
  expect(screen.queryByRole("heading")).not.toBeInTheDocument()
})

test("EmptyState with a title alone has one line", () => {
  const { container } = render(<EmptyState title="Kompaniyalar topilmadi" />)

  expect(screen.getByText("Kompaniyalar topilmadi")).toBeInTheDocument()
  expect(container.querySelectorAll("p")).toHaveLength(1)
})

test("ListLoading holds a list's place under one name, row by row, and is no table", () => {
  render(<ListLoading rows={4} />)

  const placeholder = screen.getByLabelText("Yuklanmoqda")
  expect(placeholder.querySelectorAll('[data-slot="list-loading-row"]')).toHaveLength(4)
  // A table on screen is how the pages (and their tests) know the list has come.
  expect(screen.queryByRole("table")).not.toBeInTheDocument()
})

test.each([
  ["Loading", <Loading key="gate" />],
  ["ListLoading", <ListLoading key="list" />],
])("%s is a status that says it is loading, in words too; its bars are for the eyes only", (_, placeholder) => {
  render(placeholder)

  // One element carries the name: role status makes the name count, and a
  // status that is busy would not be announced, so it is not marked busy.
  const status = screen.getByRole("status", { name: "Yuklanmoqda" })
  expect(screen.getByLabelText("Yuklanmoqda")).toBe(status)
  expect(status).not.toHaveAttribute("aria-busy")
  expect(within(status).getByText("Yuklanmoqda")).toHaveClass("sr-only")
  const bars = status.querySelector('[aria-hidden="true"]')
  expect(bars?.querySelector('[data-slot="skeleton"]')).toBeInTheDocument()
})

test("Failed announces why it failed, and offers to try again", async () => {
  const retry = vi.fn()
  render(<Failed error={new Error("Tarmoq xatosi")} onRetry={retry} />)

  expect(screen.getByRole("alert")).toHaveTextContent("Tarmoq xatosi")

  await userEvent.click(screen.getByRole("button", { name: "Qayta urinish" }))
  expect(retry).toHaveBeenCalledTimes(1)
})

test("an empty state may carry an icon and the way forward, as a button", async () => {
  const add = vi.fn()
  render(
    <EmptyState
      icon={UserIcon}
      title="Hali mijoz yo'q"
      description="Birinchi mijozni qo'shing."
      action={
        <button type="button" onClick={add}>
          Mijoz qo&apos;shish
        </button>
      }
    />,
  )
  expect(screen.getByText("Hali mijoz yo'q").closest('[data-slot="empty-state"]')?.querySelector("svg")).toHaveAttribute("aria-hidden", "true")
  await userEvent.click(screen.getByRole("button", { name: "Mijoz qo'shish" }))
  expect(add).toHaveBeenCalledTimes(1)
})

test("a record not found is said as a heading and a line under it", () => {
  render(<NotFound title="Mijoz topilmadi" description="Bu mijoz o'chirilgan." />)
  expect(screen.getByRole("heading", { level: 1, name: "Mijoz topilmadi" })).toBeInTheDocument()
  expect(screen.getByText("Bu mijoz o'chirilgan.")).toBeInTheDocument()
})

test("the splash is a status that says what is going on", () => {
  render(<Splash>Telegram orqali kirilmoqda…</Splash>)
  expect(screen.getByRole("status")).toHaveTextContent("Telegram orqali kirilmoqda…")
})

test("a state screen heads its message and holds the way out under it", () => {
  render(
    <StateScreen icon={CalendarXIcon} tone="red" title="Obuna muddati tugagan" description="Administrator bilan bog'laning.">
      <button type="button">Boshqa kompaniyani tanlash</button>
    </StateScreen>,
  )
  expect(screen.getByRole("heading", { level: 1, name: "Obuna muddati tugagan" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Boshqa kompaniyani tanlash" })).toBeInTheDocument()
})

test("the splash's mark is Hisob24's, for a screen reader too", () => {
  render(<Splash>Telegram orqali kirilmoqda…</Splash>)

  expect(screen.getByRole("img", { name: "Hisob24" })).toHaveTextContent("H24")
})

test("the splash's mark is the brand's fill: black glass in the light, lavender with a gold rim in the night", () => {
  render(<Splash>Telegram orqali kirilmoqda</Splash>)
  const mark = screen.getByRole("img", { name: "Hisob24" })
  expect(mark).toHaveClass("bg-(image:--brand-fill)", "shadow-(--mark-shadow)")
  expect(mark).not.toHaveClass("bg-brand-panel")
})

test("an empty state is frosted glass, its icon ringed in white, its button the prototype's smaller capsule", () => {
  const { container } = render(<EmptyState icon={UserIcon} title="Mijoz yo'q" action={<MainButton>Mijoz qo&apos;shish</MainButton>} />)
  const empty = container.querySelector('[data-slot="empty-state"]')!
  expect(empty).toHaveClass("surface", "rounded-group")
  expect(empty).not.toHaveClass("bg-card")
  expect(empty.querySelector("[aria-hidden=true]")).toHaveClass("shadow-[inset_0_0_0_1px_rgba(255,255,255,.6)]")
  expect(screen.getByRole("button", { name: "Mijoz qo'shish" }).parentElement).toHaveClass(
    "[&_[data-slot=main-button]]:h-[46px]",
    "[&_[data-slot=main-button]]:w-auto",
    "[&_[data-slot=main-button]]:px-[22px]",
  )
})

test("a record not found, a failure and a list loading stand on the same frosted glass as a group", () => {
  const { container, rerender } = render(<NotFound title="Mijoz topilmadi" description="U o'chirilgan." />)
  expect(container.querySelector('[data-slot="not-found"]')).toHaveClass("surface")

  rerender(<Failed error={new Error("Tarmoq xatosi")} onRetry={() => {}} />)
  expect(screen.getByRole("alert").parentElement).toHaveClass("surface")
  expect(screen.getByRole("alert").parentElement).not.toHaveClass("bg-card")

  rerender(<ListLoading />)
  expect(screen.getByRole("status").querySelector('[aria-hidden="true"]')).toHaveClass("surface")
})
