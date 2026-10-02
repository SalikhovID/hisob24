import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { api, call } from "./api"

// CompanyFilter is what the companies page asks the list for.
export interface CompanyFilter {
  search: string
  status: "" | "active" | "expired"
  page: number
}

// keys name every cached request, so mutations can refresh what they change.
export const keys = {
  me: ["me"] as const,
  companies: (filter?: CompanyFilter) => (filter ? (["companies", filter] as const) : (["companies"] as const)),
  company: (id: number) => ["company", id] as const,
  billings: (companyId: number) => ["billings", companyId] as const,
}

// useMe is the signed-in admin.
export function useMe() {
  return useQuery({ queryKey: keys.me, queryFn: () => call(api.GET("/admin/me")) })
}

// useCompanies is one page of the companies list; the previous page stays
// on screen while the next one loads.
export function useCompanies(filter: CompanyFilter) {
  return useQuery({
    queryKey: keys.companies(filter),
    queryFn: () =>
      call(
        api.GET("/admin/companies", {
          params: { query: { search: filter.search || undefined, status: filter.status || undefined, page: filter.page } },
        }),
      ),
    placeholderData: keepPreviousData,
  })
}

// useCompany is one company with its users.
export function useCompany(id: number) {
  return useQuery({
    queryKey: keys.company(id),
    queryFn: () => call(api.GET("/admin/companies/{id}", { params: { path: { id } } })),
  })
}

// useBillings is a company's payments, newest first.
export function useBillings(companyId: number) {
  return useQuery({
    queryKey: keys.billings(companyId),
    queryFn: () => call(api.GET("/admin/companies/{id}/billings", { params: { path: { id: companyId } } })),
  })
}
