import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { identityOf } from "@/test/identity"
import { Identity } from "./identity"

test("Identity is a title over a subtitle, beside the avatar of the title", () => {
  const { container } = render(<Identity title="Ali Valiyev" subtitle="+998 90 123 45 67" seed="998901234567" />)

  expect(identityOf(container)).toEqual(["Ali Valiyev", "+998 90 123 45 67"])
  expect(screen.getByText("AV")).toHaveAttribute("aria-hidden", "true")
})

test("Identity without a subtitle has one line; with no name behind the title, the avatar shows an icon", () => {
  const { container } = render(<Identity title="+998 94 444 55 66" name={null} seed="998944445566" />)

  expect(identityOf(container)).toEqual(["+998 94 444 55 66", null])
  expect(container.querySelector('[data-slot="avatar"]')).toHaveTextContent("")
})
