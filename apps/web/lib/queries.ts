import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api, call } from "./api"
import { setAccessToken } from "./session"

export const meKey = ["me"] as const

// useMe is the signed-in user, the company they work in now and all of theirs.
export function useMe() {
  return useQuery({ queryKey: meKey, queryFn: () => call(api.GET("/app/me")) })
}

// useSwitchCompany moves the session to a company, or to none, and keeps the
// new access token. /app/me is dropped, so the next page asks for it afresh
// rather than showing the old company.
export function useSwitchCompany() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (companyId: number | null) =>
      call(api.POST("/app/auth/switch-company", { body: { company_id: companyId } })),
    onSuccess: (tokens) => {
      setAccessToken(tokens.access_token)
      queryClient.removeQueries({ queryKey: meKey })
    },
  })
}
