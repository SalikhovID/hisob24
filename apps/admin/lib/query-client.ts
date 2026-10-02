import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query"
import { ApiError } from "./api"

// refused is an answer that asking again will not change.
const refused = (error: unknown) => error instanceof ApiError && error.status >= 400 && error.status < 500

// makeQueryClient builds the panel's query client: a request that finds no
// session (401 unauthorized) leads to /login, and refusals are not retried.
// A failed login is a 401 too, but with its own code, and stays put.
export function makeQueryClient(onUnauthorized = () => window.location.replace("/login")) {
  const onError = (error: unknown) => {
    if (error instanceof ApiError && error.status === 401 && error.code === "unauthorized") onUnauthorized()
  }
  return new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      queries: {
        retry: (failures, error) => !refused(error) && failures < 2,
        refetchOnWindowFocus: false,
      },
    },
  })
}
