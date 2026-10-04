import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { api, call } from "./api"
import { leave } from "./navigate"
import { clearSession, setAccessToken } from "./session"

export const meKey = ["me"] as const

// useMe is the signed-in user, the company they work in now and all of theirs.
export function useMe() {
  return useQuery({ queryKey: meKey, queryFn: () => call(api.GET("/app/me")) })
}

// employeesKey names a company's members in the cache. It is per company:
// a session that switches companies never sees the other one's.
export const employeesKey = (companyId: number | null) => ["employees", companyId] as const

// useEmployees is the members of the company the owner works in. Only the
// owner may ask: with companyId null (an employee, or not known yet) nothing
// is asked.
export function useEmployees(companyId: number | null) {
  return useQuery({
    queryKey: employeesKey(companyId),
    queryFn: () => call(api.GET("/app/employees")),
    enabled: companyId !== null,
  })
}

// customerTypesKey and customerDropdownsKey name what a company's owner set
// up for its customers in the cache, per company like the employees.
export const customerTypesKey = (companyId: number | null) => ["customer-types", companyId] as const
export const customerDropdownsKey = (companyId: number | null) => ["customer-dropdowns", companyId] as const

// useCustomerTypes is the customer types of the company the session works
// in, each with its fields; every member may ask. With companyId null (not
// known yet) nothing is asked.
export function useCustomerTypes(companyId: number | null) {
  return useQuery({
    queryKey: customerTypesKey(companyId),
    queryFn: () => call(api.GET("/app/customer-types")),
    enabled: companyId !== null,
  })
}

// useCustomerDropdowns is the company's dropdowns, each with its options.
export function useCustomerDropdowns(companyId: number | null) {
  return useQuery({
    queryKey: customerDropdownsKey(companyId),
    queryFn: () => call(api.GET("/app/customer-dropdowns")),
    enabled: companyId !== null,
  })
}

// customersKey names a company's customers in the cache, whatever the
// filter: every list of them begins with it, so one call drops them all.
export const customersKey = (companyId: number | null) => ["customers", companyId] as const

// CustomerFilter narrows the customers list: a search, one type (null for
// every type) and the page.
export interface CustomerFilter {
  search: string
  typeId: number | null
  page: number
}

// useCustomers is a page of the customers of the company the session works
// in, the newest first; every member may ask. With companyId null (not
// known yet) nothing is asked.
export function useCustomers(companyId: number | null, filter: CustomerFilter) {
  return useQuery({
    queryKey: [...customersKey(companyId), filter],
    queryFn: () =>
      call(
        api.GET("/app/customers", {
          params: { query: { search: filter.search || undefined, type_id: filter.typeId ?? undefined, page: filter.page } },
        }),
      ),
    enabled: companyId !== null,
    // The list on screen stays while the next filter's answer is on its way.
    placeholderData: keepPreviousData,
  })
}

// customerKey names one customer of a company in the cache.
export const customerKey = (companyId: number | null, id: number) => ["customer", companyId, id] as const

// useCustomer is a customer of the company the session works in, with its
// answers; every member may ask.
export function useCustomer(companyId: number | null, id: number) {
  return useQuery({
    queryKey: customerKey(companyId, id),
    queryFn: () => call(api.GET("/app/customers/{id}", { params: { path: { id } } })),
    enabled: companyId !== null,
  })
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

// useLogout revokes the refresh token and leaves for /login as a new page,
// so nothing of the session stays in memory. A failed sign-out says why and
// keeps the session: the cookie would still let the user back in.
export function useLogout() {
  return useMutation({
    mutationFn: () => call(api.POST("/app/auth/logout")),
    onSuccess: () => {
      clearSession()
      leave("/login")
    },
    onError: (error) => toast.error(error.message),
  })
}
