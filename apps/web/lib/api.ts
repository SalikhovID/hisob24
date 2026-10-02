import { createApiClient } from "@hisob24/api-client"
import { accessToken } from "./session"

// send hands a request to fetch with the access token, if there is one.
// fetch is looked up per request, not when the module loads, so a patched
// fetch (MSW in the tests) is the one used.
async function send(request: Request): Promise<Response> {
  const token = accessToken()
  if (token) request.headers.set("Authorization", `Bearer ${token}`)
  return globalThis.fetch(request)
}

// api reaches the Go API through the Next.js rewrite on this origin.
export const api = createApiClient(typeof window === "undefined" ? "/api" : `${window.location.origin}/api`, send)

// ApiError is a refusal from the API: its status, error code and the Uzbek
// message to show.
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

type Result<T> = { data?: T; error?: unknown; response: Response }

// call unwraps an api request: its data, or an ApiError carrying the API's
// error code and message.
export async function call<T>(request: Promise<Result<T>>): Promise<T> {
  let result: Result<T>
  try {
    result = await request
  } catch {
    throw new ApiError(0, "network_error", "Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring")
  }
  const { data, error, response } = result
  if (error !== undefined || !response.ok) {
    const body = (error ?? {}) as { error?: string; message?: string }
    throw new ApiError(
      response.status,
      body.error ?? "unknown_error",
      body.message ?? "Kutilmagan xatolik. Birozdan keyin qayta urinib ko'ring",
    )
  }
  return data as T
}
