import { expect, test, vi } from "vitest"
import { createApiClient } from "./index"

test("so'rovni baseUrl ostidagi yo'lga yuboradi va JSON javobni qaytaradi", async () => {
  const fetchMock = vi.fn(
    async (_request: Request) =>
      new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
  )
  const client = createApiClient("http://localhost:3001/api", fetchMock)

  const { data } = await client.GET("/healthz")

  expect(data).toEqual({ status: "ok" })
  expect(fetchMock.mock.calls[0][0].url).toBe("http://localhost:3001/api/healthz")
})
