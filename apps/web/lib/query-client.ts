import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query"
import { ApiError } from "./api"
import { leave } from "./navigate"
import { meKey } from "./queries"

// refused is an answer that asking again will not change.
const refused = (error: unknown) => error instanceof ApiError && error.status >= 400 && error.status < 500

// standingChanged is a refusal that says what /app/me told the app is old:
// the company's subscription ran out (402), or the user is its owner no more
// (403 owner_only). The API reads both on every request.
const standingChanged = (error: unknown) =>
  error instanceof ApiError && (error.code === "subscription_expired" || error.code === "owner_only")

// makeQueryClient builds the app's query client. A lost session (401
// unauthorized, which the API client answers only once the refresh failed
// too) leads to /login; a wrong login code is a 401 too, but with its own
// code, and stays put. A refusal for the subscription or the owner's role
// has /app/me asked again, so the shell shows where the session stands now:
// /expired, or the sections of an employee. Refusals are not retried.
export function makeQueryClient(onUnauthorized = () => leave("/login")) {
  const onError = (error: unknown, fromMe: boolean) => {
    if (error instanceof ApiError && error.status === 401 && error.code === "unauthorized") onUnauthorized()
    // /app/me's own refusal is the news itself: asking again would not end.
    if (standingChanged(error) && !fromMe) client.invalidateQueries({ queryKey: meKey })
  }
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError: (error, query) => onError(error, query.queryKey[0] === meKey[0]) }),
    mutationCache: new MutationCache({ onError: (error) => onError(error, false) }),
    defaultOptions: {
      queries: {
        retry: (failures, error) => !refused(error) && failures < 2,
        refetchOnWindowFocus: false,
      },
    },
  })
  return client
}
