import { screen, waitFor } from "@testing-library/react"
import { expect, test, vi } from "vitest"
import { api, call } from "@/lib/api"
import { accessToken } from "@/lib/session"
import { ALI } from "@/mocks/data"
import { router } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { CodeStep } from "./code-step"

const sendCode = (phone: string) => call(api.POST("/app/auth/sms/send", { body: { phone } }))

test("the sixth digit signs in and opens the dashboard", async () => {
  await sendCode(ALI)
  const { user } = renderWithProviders(<CodeStep phone="+998 90 123 45 67" retryAfter={60} onChangePhone={vi.fn()} />)

  await user.type(screen.getByRole("textbox", { name: "Kod" }), "123456")

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"))
  expect(accessToken()).toMatch(new RegExp(`^access:${ALI}:1:`))
})
