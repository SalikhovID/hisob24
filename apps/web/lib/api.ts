import { createApiClient } from "@hisob24/api-client"
import { accessToken, setAccessToken } from "./session"

// The Go API sits behind the Next.js rewrite on this origin. fetch is looked
// up per request, not when the module loads, so a patched fetch (MSW in the
// tests) is the one used.
const BASE = typeof window === "undefined" ? "/api" : `${window.location.origin}/api`

// plain asks the API as is, with no token: the refresh itself goes this way.
const plain = createApiClient(BASE, (request) => globalThis.fetch(request))

// refresh trades the refresh cookie for a new access token. Requests turned
// down together share one refresh: the cookie rotates, so a second refresh
// with the same cookie would be refused.
let refreshing: Promise<boolean> | null = null

function refresh(): Promise<boolean> {
  refreshing ??= plain
    .POST("/app/auth/refresh")
    .then(({ data }) => {
      if (!data) return false
      setAccessToken(data.access_token)
      return true
    })
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

function withToken(request: Request): Request {
  const token = accessToken()
  if (token) request.headers.set("Authorization", `Bearer ${token}`)
  return request
}

// send hands a request to fetch with the access token. When the API turns
// the token down (none after a reload, or an expired one) the session is
// refreshed and the request goes once more, from a copy taken beforehand
// since sending uses up the body.
async function send(request: Request): Promise<Response> {
  const retry = request.clone()
  const response = await globalThis.fetch(withToken(request))
  if (response.status !== 401 || !(await refresh())) return response
  return globalThis.fetch(withToken(retry))
}

export const api = createApiClient(BASE, send)

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
