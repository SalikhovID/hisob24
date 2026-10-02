import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query"
import { ApiError } from "./api"

// refused is an answer that asking again will not change.
const refused = (error: unknown) => error instanceof ApiError && error.status >= 400 && error.status < 500

// makeQueryClient builds the panel's query client: a 401 from any request
// (the session ended) leads to /login, and refusals are not retried.
export function makeQueryClient(onUnauthorized = () => window.location.replace("/login")) {
  const onError = (error: unknown) => {
    if (error instanceof ApiError && error.status === 401) onUnauthorized()
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
