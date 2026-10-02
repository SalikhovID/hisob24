import { http, HttpResponse } from "msw"
import { expect, test } from "vitest"
import { ALI, VALI } from "@/mocks/data"
import { server } from "@/test/server"
import { signIn } from "@/test/session"
import { api, ApiError, call } from "./api"
import { accessToken, clearSession, setAccessToken } from "./session"

const sendCode = () => call(api.POST("/app/auth/sms/send", { body: { phone: ALI } }))

test("call returns the data of a successful request", async () => {
  await expect(sendCode()).resolves.toEqual({ retry_after: 60 })
})

test("call throws the API's error code and message", async () => {
  await sendCode()

  const err = await sendCode().catch((e: unknown) => e)

  expect(err).toBeInstanceOf(ApiError)
  expect(err).toMatchObject({
    status: 429,
    code: "too_many_requests",
    message: "Kodni qayta olish uchun bir daqiqa kuting",
  })
})

test("call turns a network failure into an ApiError people can read", async () => {
  server.use(http.post("*/api/app/auth/sms/send", () => HttpResponse.error()))

  const err = await sendCode().catch((e: unknown) => e)

  expect(err).toBeInstanceOf(ApiError)
  expect(err).toMatchObject({
    status: 0,
    code: "network_error",
    message: "Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring",
  })
})

test("requests carry the access token as a Bearer header", async () => {
  await signIn(ALI)

  const me = await call(api.GET("/app/me"))

  expect(me.user).toEqual({ phone: ALI, full_name: "Ali Valiyev" })
  expect(me.company).toMatchObject({ id: 1, name: "Olma Savdo", role: "owner" })
})

test("after a reload the first request refreshes the session and goes through", async () => {
  await signIn(ALI)
  clearSession()

  const me = await call(api.GET("/app/me"))

  expect(me.user.phone).toBe(ALI)
  expect(accessToken()).toMatch(new RegExp(`^access:${ALI}:1:`))
})

test("a request with an expired token is sent again, body and all, after the refresh", async () => {
  await signIn(VALI)
  setAccessToken("expired")

  const tokens = await call(api.POST("/app/auth/switch-company", { body: { company_id: 2 } }))

  expect(tokens.company_id).toBe(2)
  expect(tokens.access_token).toMatch(new RegExp(`^access:${VALI}:2:`))
})

test("requests refused at the same time share one refresh", async () => {
  await signIn(ALI)
  clearSession()
  let refreshes = 0
  server.use(
    http.post("*/api/app/auth/refresh", () => {
      refreshes += 1
    }),
  )

  const [first, second] = await Promise.all([call(api.GET("/app/me")), call(api.GET("/app/me"))])

  expect(first.user.phone).toBe(ALI)
  expect(second.user.phone).toBe(ALI)
  expect(refreshes).toBe(1)
})

test("when the refresh is refused too, the session is cleared and the request fails as unauthorized", async () => {
  setAccessToken("expired")

  const err = await call(api.GET("/app/me")).catch((e: unknown) => e)

  expect(err).toMatchObject({ status: 401, code: "unauthorized" })
  expect(accessToken()).toBeNull()
})

test("a wrong login code is not taken for an expired session", async () => {
  let refreshes = 0
  server.use(
    http.post("*/api/app/auth/refresh", () => {
      refreshes += 1
    }),
  )

  const err = await call(api.POST("/app/auth/sms/verify", { body: { phone: VALI, code: "000000" } })).catch(
    (e: unknown) => e,
  )

  expect(err).toMatchObject({ status: 401, code: "invalid_code" })
  expect(refreshes).toBe(0)
})
