import { useQuery } from "@tanstack/react-query"
import { api, call } from "./api"

// keys name every cached request, so mutations can refresh what they change.
export const keys = {
  me: ["me"] as const,
}

// useMe is the signed-in admin.
export function useMe() {
  return useQuery({ queryKey: keys.me, queryFn: () => call(api.GET("/admin/me")) })
}
