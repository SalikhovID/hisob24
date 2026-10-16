import { render, screen } from "@testing-library/react"
import { useState } from "react"
import { expect, test } from "vitest"
import { BackLink } from "@/components/kit/page-title"
import { BackTargetProvider, useBackTarget } from "./back-target"

// Probe says the way back the shell knows of.
function Probe() {
  const target = useBackTarget()
  return <p data-testid="probe">{target ? `${target.label} ${target.href}` : "none"}</p>
}

function Page({ back }: { back: boolean }) {
  return back ? <BackLink href="/customers" label="Mijozlar" /> : <p>Mijozlar</p>
}

test("a page's way back is the shell's to know while the page shows it, and gone with it", async () => {
  function Shell() {
    const [back, setBack] = useState(true)
    return (
      <BackTargetProvider>
        <Probe />
        <button type="button" onClick={() => setBack((shown) => !shown)}>
          almashtirish
        </button>
        <Page back={back} />
      </BackTargetProvider>
    )
  }
  render(<Shell />)
  expect(screen.getByTestId("probe")).toHaveTextContent("Mijozlar /customers")
  screen.getByRole("button", { name: "almashtirish" }).click()
  expect(await screen.findByText("none")).toBeInTheDocument()
})

test("inside the shell a page's way back is a phone's: on a wide screen the shell's top bar leads back", () => {
  render(
    <BackTargetProvider>
      <BackLink href="/customers" label="Mijozlar" />
    </BackTargetProvider>,
  )
  expect(screen.getByRole("link", { name: "Mijozlar" })).toHaveClass("md:hidden")
})

test("without the shell (a page of its own, as the company list) a way back stands on every screen", () => {
  render(<BackLink href="/profile" label="Profil" />)
  const link = screen.getByRole("link", { name: "Profil" })
  expect(link).toHaveAttribute("href", "/profile")
  expect(link).not.toHaveClass("md:hidden")
})
