import { http, HttpResponse } from "msw"
import { expect, test } from "vitest"
import { server } from "@/test/server"
import { api, ApiError, call } from "./api"

test("call returns the data of a successful request", async () => {
  await expect(call(api.GET("/admin/me"))).resolves.toEqual({ telegram_id: 461603558, full_name: "Owner" })
})

test("call throws the API's error code and message", async () => {
  server.use(
    http.get("*/api/admin/me", () =>
      HttpResponse.json({ error: "unauthorized", message: "Avval tizimga kiring" }, { status: 401 }),
    ),
  )

  const err = await call(api.GET("/admin/me")).catch((e: unknown) => e)

  expect(err).toBeInstanceOf(ApiError)
  expect(err).toMatchObject({ status: 401, code: "unauthorized", message: "Avval tizimga kiring" })
})

test("call turns a network failure into an ApiError people can read", async () => {
  server.use(http.get("*/api/admin/me", () => HttpResponse.error()))

  const err = await call(api.GET("/admin/me")).catch((e: unknown) => e)

  expect(err).toBeInstanceOf(ApiError)
  expect(err).toMatchObject({
    status: 0,
    code: "network_error",
    message: "Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring",
  })
})
