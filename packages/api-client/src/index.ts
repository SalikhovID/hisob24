import createClient from "openapi-fetch"
import type { paths } from "./schema"

export type { components, paths } from "./schema"

// createApiClient returns a typed client for the Go API. In the browser the
// API sits behind the Next.js rewrite on the same origin, hence "/api".
export function createApiClient(
  baseUrl = "/api",
  fetchImpl?: (input: Request) => Promise<Response>,
) {
  return createClient<paths>({ baseUrl, fetch: fetchImpl })
}
