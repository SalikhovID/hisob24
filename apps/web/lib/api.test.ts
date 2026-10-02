import { http, HttpResponse } from "msw"
import { expect, test } from "vitest"
import { ALI } from "@/mocks/data"
import { server } from "@/test/server"
import { api, ApiError, call } from "./api"

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
