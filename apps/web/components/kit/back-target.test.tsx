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

test("a page's way back is a phone's: on a wide screen the shell's top bar leads back", () => {
  render(<BackLink href="/customers" label="Mijozlar" />)
  expect(screen.getByRole("link", { name: "Mijozlar" })).toHaveClass("md:hidden")
})

test("without the shell a way back stands alone", () => {
  render(<BackLink href="/" label="Bosh sahifa" />)
  expect(screen.getByRole("link", { name: "Bosh sahifa" })).toHaveAttribute("href", "/")
})
