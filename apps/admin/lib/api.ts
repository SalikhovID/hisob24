import { createApiClient } from "@hisob24/api-client"

// api reaches the Go API through the Next.js rewrite on this origin. fetch
// is looked up per request, not when the module loads, so a patched fetch
// (MSW in the tests) is the one used.
export const api = createApiClient(
  typeof window === "undefined" ? "/api" : `${window.location.origin}/api`,
  (request) => globalThis.fetch(request),
)

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
  const { data, error, response } = await request
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
