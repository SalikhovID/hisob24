import { act, screen, waitFor } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { expect, test, vi } from "vitest"
import { api, call } from "@/lib/api"
import { accessToken } from "@/lib/session"
import { ALI, VALI } from "@/mocks/data"
import { router } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { server } from "@/test/server"
import { CodeStep } from "./code-step"

const sendCode = (phone: string) => call(api.POST("/app/auth/sms/send", { body: { phone } }))

test("the sixth digit signs in and opens the dashboard", async () => {
  await sendCode(ALI)
  const { user } = renderWithProviders(<CodeStep phone="+998 90 123 45 67" retryAfter={60} onChangePhone={vi.fn()} />)

  await user.type(screen.getByRole("textbox", { name: "Kod" }), "123456")

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"))
  expect(accessToken()).toMatch(new RegExp(`^access:${ALI}:1:`))
})

test("someone in several companies goes on to choose one", async () => {
  await sendCode(VALI)
  const { user } = renderWithProviders(<CodeStep phone="+998 90 222 33 44" retryAfter={60} onChangePhone={vi.fn()} />)

  await user.type(screen.getByRole("textbox", { name: "Kod" }), "123456")

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/select-company"))
  expect(accessToken()).toMatch(new RegExp(`^access:${VALI}:none:`))
})

test("a wrong code is cleared and the API's message shown", async () => {
  await sendCode(ALI)
  const { user } = renderWithProviders(<CodeStep phone="+998 90 123 45 67" retryAfter={60} onChangePhone={vi.fn()} />)
  const input = screen.getByRole("textbox", { name: "Kod" })

  await user.type(input, "000000")

  expect(await screen.findByRole("alert")).toHaveTextContent("Kod noto'g'ri yoki muddati o'tgan")
  expect(input).toHaveValue("")
  expect(router.replace).not.toHaveBeenCalled()
})

test("typing a new code hides the old error", async () => {
  await sendCode(ALI)
  const { user } = renderWithProviders(<CodeStep phone="+998 90 123 45 67" retryAfter={60} onChangePhone={vi.fn()} />)
  const input = screen.getByRole("textbox", { name: "Kod" })
  await user.type(input, "000000")
  await screen.findByRole("alert")

  await user.type(input, "1")

  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
})

test("the resend button waits out the timer", () => {
  vi.useFakeTimers()
  try {
    renderWithProviders(<CodeStep phone="+998 90 123 45 67" retryAfter={60} onChangePhone={vi.fn()} />)
    expect(screen.getByRole("button", { name: "Kodni qayta yuborish (60)" })).toBeDisabled()

    act(() => vi.advanceTimersByTime(1000))
    expect(screen.getByRole("button", { name: "Kodni qayta yuborish (59)" })).toBeDisabled()

    act(() => vi.advanceTimersByTime(59_000))
    expect(screen.getByRole("button", { name: "Kodni qayta yuborish" })).toBeEnabled()
  } finally {
    vi.useRealTimers()
  }
})

test("resending asks for a new code and starts the timer again", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  try {
    await sendCode(ALI)
    let sent: unknown
    server.use(
      http.post("*/api/app/auth/sms/send", async ({ request }) => {
        sent = await request.clone().json()
      }),
    )
    const { user } = renderWithProviders(
      <CodeStep phone="+998 90 123 45 67" retryAfter={60} onChangePhone={vi.fn()} />,
      { advanceTimers: vi.advanceTimersByTime },
    )
    act(() => vi.advanceTimersByTime(60_000))

    await user.click(screen.getByRole("button", { name: "Kodni qayta yuborish" }))

    expect(await screen.findByRole("button", { name: "Kodni qayta yuborish (60)" })).toBeDisabled()
    expect(sent).toEqual({ phone: ALI })
  } finally {
    vi.useRealTimers()
  }
})

test("a resend that fails says why and can be tried again", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  try {
    server.use(http.post("*/api/app/auth/sms/send", () => HttpResponse.error()))
    const { user } = renderWithProviders(
      <CodeStep phone="+998 90 123 45 67" retryAfter={60} onChangePhone={vi.fn()} />,
      { advanceTimers: vi.advanceTimersByTime },
    )
    act(() => vi.advanceTimersByTime(60_000))

    await user.click(screen.getByRole("button", { name: "Kodni qayta yuborish" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring",
    )
    expect(screen.getByRole("button", { name: "Kodni qayta yuborish" })).toBeEnabled()
  } finally {
    vi.useRealTimers()
  }
})
