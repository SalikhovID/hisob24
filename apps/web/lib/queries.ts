import {
  type InfiniteData,
  keepPreviousData,
  type QueryClient,
  useInfiniteQuery,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { toast } from "sonner"
import { api, ApiError, call } from "./api"
import { leave } from "./navigate"
import { clearSession, setAccessToken } from "./session"
import type { NavKey } from "./nav"
import type { Location, Task, TaskPage } from "./types"

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

// taskStagesKey and taskTypesKey name what a company's owner set up for its
// tasks in the cache, membersKey the company's members; per company like
// the customer settings.
export const taskStagesKey = (companyId: number | null) => ["task-stages", companyId] as const
export const taskTypesKey = (companyId: number | null) => ["task-types", companyId] as const
export const membersKey = (companyId: number | null) => ["members", companyId] as const

// useTaskStages is the stages (the columns of the board) of the company the
// session works in, in their order; every member may ask. With companyId
// null (not known yet) nothing is asked.
export function useTaskStages(companyId: number | null) {
  return useQuery({
    queryKey: taskStagesKey(companyId),
    queryFn: () => call(api.GET("/app/task-stages")),
    enabled: companyId !== null,
  })
}

// useTaskTypes is the task types of the company the session works in, each
// with its fields; every member may ask.
export function useTaskTypes(companyId: number | null) {
  return useQuery({
    queryKey: taskTypesKey(companyId),
    queryFn: () => call(api.GET("/app/task-types")),
    enabled: companyId !== null,
  })
}

// useMembers is the members of the company the session works in, the owner
// first; every member may ask: a task's assignee is chosen among them.
export function useMembers(companyId: number | null) {
  return useQuery({
    queryKey: membersKey(companyId),
    queryFn: () => call(api.GET("/app/members")),
    enabled: companyId !== null,
  })
}

// rolesKey names a company's roles in the cache, per company like the
// employees.
export const rolesKey = (companyId: number | null) => ["roles", companyId] as const

// useRoles is the roles of the company the owner works in, by name, each
// with how many members hold it. Only the owner may ask: with companyId
// null (an employee, or not known yet) nothing is asked.
export function useRoles(companyId: number | null) {
  return useQuery({
    queryKey: rolesKey(companyId),
    queryFn: () => call(api.GET("/app/roles")),
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

// tasksKey names a company's tasks in the cache, whatever the filter: every
// list of them begins with it, so one call drops them all.
export const tasksKey = (companyId: number | null) => ["tasks", companyId] as const

// TaskFilter narrows the tasks list: one location (null for every one the
// member works in: the customer's page), a search, one type, one stage, one
// assignee (a phone; "" for every one), one customer (null for every one)
// and the page.
export interface TaskFilter {
  locationId: number | null
  search: string
  typeId: number | null
  stageId: number | null
  assignee: string
  customerId: number | null
  page: number
}

// useTasks is a page of the tasks of the company the session works in, the
// one due soonest first; every member may ask. With companyId null (not
// known yet, or the list not on screen) nothing is asked.
export function useTasks(companyId: number | null, filter: TaskFilter) {
  return useQuery({
    queryKey: [...tasksKey(companyId), filter],
    queryFn: () =>
      call(
        api.GET("/app/tasks", {
          params: {
            query: {
              location_id: filter.locationId ?? undefined,
              search: filter.search || undefined,
              type_id: filter.typeId ?? undefined,
              stage_id: filter.stageId ?? undefined,
              assignee: filter.assignee || undefined,
              customer_id: filter.customerId ?? undefined,
              page: filter.page,
            },
          },
        }),
      ),
    enabled: companyId !== null,
    // The list on screen stays while the next filter's answer is on its way.
    placeholderData: keepPreviousData,
  })
}

// StageFilter narrows a stage's column of the board: the location, the
// search, one type and one assignee; the stage is the column's own.
export type StageFilter = Pick<TaskFilter, "locationId" | "search" | "typeId" | "assignee">

// stageTasksKey names a stage's column in the cache: the tasks of the stage
// under the filter, page after page.
export const stageTasksKey = (companyId: number | null, stageId: number, filter: StageFilter) =>
  [...tasksKey(companyId), "stage", stageId, filter] as const

// useStageTasks is a stage's column of the board: the tasks of the stage,
// the one due soonest first, twenty at a time, with more to ask for.
export function useStageTasks(companyId: number | null, stageId: number, filter: StageFilter) {
  return useInfiniteQuery({
    queryKey: stageTasksKey(companyId, stageId, filter),
    queryFn: ({ pageParam }) =>
      call(
        api.GET("/app/tasks", {
          params: {
            query: {
              location_id: filter.locationId ?? undefined,
              search: filter.search || undefined,
              type_id: filter.typeId ?? undefined,
              assignee: filter.assignee || undefined,
              stage_id: stageId,
              page: pageParam,
            },
          },
        }),
      ),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.page_size < last.total ? last.page + 1 : undefined),
    enabled: companyId !== null,
    placeholderData: keepPreviousData,
  })
}

// useAssignedCounts is how many tasks the member is assigned in each of
// the locations, by the location's id, for the owner's warning before
// restricting them (logic/locations.md, section 5): one list request per
// location, the total of each. With companyId null nothing is asked.
export function useAssignedCounts(companyId: number | null, phone: string, locations: Location[]): Record<number, number> {
  const results = useQueries({
    queries: locations.map((location) => ({
      queryKey: [...tasksKey(companyId), "assigned", phone, location.id],
      queryFn: () => call(api.GET("/app/tasks", { params: { query: { assignee: phone, location_id: location.id, page: 1 } } })),
      enabled: companyId !== null,
    })),
  })
  const counts: Record<number, number> = {}
  results.forEach((result, i) => {
    if (result.data) counts[locations[i].id] = result.data.total
  })
  return counts
}

// taskKey names one task of a company in the cache.
export const taskKey = (companyId: number | null, id: number) => ["task", companyId, id] as const

// useTask is a task of the company the session works in, with its answers;
// every member may ask.
export function useTask(companyId: number | null, id: number) {
  return useQuery({
    queryKey: taskKey(companyId, id),
    queryFn: () => call(api.GET("/app/tasks/{id}", { params: { path: { id } } })),
    enabled: companyId !== null,
  })
}

// taskHistoryKey names a task's history in the cache.
export const taskHistoryKey = (companyId: number | null, id: number) => ["task-history", companyId, id] as const

// useTaskHistory is what happened to a task, the latest first. It is the
// owner's to see: with companyId null (an employee, or not known yet)
// nothing is asked.
export function useTaskHistory(companyId: number | null, id: number) {
  return useQuery({
    queryKey: taskHistoryKey(companyId, id),
    queryFn: () => call(api.GET("/app/tasks/{id}/history", { params: { path: { id } } })),
    enabled: companyId !== null,
  })
}

// A stage's column as the cache holds it.
type Column = InfiniteData<TaskPage, number>

// sooner is the API's order: the task due first, then the older of one day.
const sooner = (a: Task, b: Task) => a.deadline.localeCompare(b.deadline) || a.id - b.id

// moveInColumns moves the task into the stage across every column of the
// board in the cache: out of the column it stands in, into the new one at
// its place by its deadline, the totals following; the pages keep their
// size, so what is left to ask for stays right. The server's answer, asked
// for after, settles anything a filter would have changed.
function moveInColumns(queryClient: QueryClient, companyId: number, task: Task, stageId: number) {
  for (const [key, column] of queryClient.getQueriesData<Column>({ queryKey: [...tasksKey(companyId), "stage"] })) {
    const columnStage = key[3]
    if (!column || typeof columnStage !== "number") continue
    const items = column.pages.flatMap((page) => page.items)
    const held = items.some((item) => item.id === task.id)
    let next: Task[]
    let total = column.pages[0]?.total ?? 0
    if (columnStage === stageId) {
      next = [...items.filter((item) => item.id !== task.id), { ...task, stage_id: stageId }].sort(sooner)
      total += held ? 0 : 1
    } else if (held) {
      next = items.filter((item) => item.id !== task.id)
      total -= 1
    } else continue
    const size = column.pages[0]?.page_size ?? 20
    const pages: TaskPage[] = []
    for (let i = 0; i < Math.max(1, Math.ceil(next.length / size)); i += 1) {
      pages.push({ items: next.slice(i * size, (i + 1) * size), total, page: i + 1, page_size: size })
    }
    queryClient.setQueryData<Column>(key, { pages, pageParams: pages.map((page) => page.page) })
  }
}

// useMoveTask puts a task into another stage. The board shows the move at
// once and the lists ask again after; a refusal says why, puts things back
// and, since the stage may be gone, asks for the stages again too.
export function useMoveTask(companyId: number | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ task, stageId }: { task: Task; stageId: number }) =>
      call(api.PATCH("/app/tasks/{id}/stage", { params: { path: { id: task.id } }, body: { stage_id: stageId } })),
    onMutate: ({ task, stageId }) => {
      if (companyId !== null) moveInColumns(queryClient, companyId, task, stageId)
    },
    onSuccess: (moved) => queryClient.setQueryData(taskKey(companyId, moved.id), moved),
    onError: (error) => {
      toast.error(error.message)
      if (error instanceof ApiError && error.status === 400) queryClient.invalidateQueries({ queryKey: taskStagesKey(companyId) })
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: tasksKey(companyId) }),
  })
}

// useCustomerSuggestions is the customers whose phones begin with the
// digits typed (after 998), for the task form to pick one from; asked once
// three digits are there, and never for fewer.
export function useCustomerSuggestions(companyId: number | null, digits: string) {
  return useQuery({
    queryKey: [...customersKey(companyId), "suggest", digits],
    queryFn: () => call(api.GET("/app/customers", { params: { query: { phone: digits, page: 1 } } })),
    enabled: companyId !== null && digits.length >= 3,
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

// customerHistoryKey names a customer's history in the cache.
export const customerHistoryKey = (companyId: number | null, id: number) => ["customer-history", companyId, id] as const

// useCustomerHistory is what happened to a customer, the latest first. It
// is the owner's to see: with companyId null (an employee, or not known yet)
// nothing is asked.
export function useCustomerHistory(companyId: number | null, id: number) {
  return useQuery({
    queryKey: customerHistoryKey(companyId, id),
    queryFn: () => call(api.GET("/app/customers/{id}/history", { params: { path: { id } } })),
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

// useSetNavOrder keeps the member's own order of the menu in the company
// (null: the default; logic/roles.md, section 8). The API answers with
// /app/me as it is now, which the cache takes.
export function useSetNavOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sections: NavKey[] | null) => call(api.PUT("/app/me/nav", { body: { sections } })),
    onSuccess: (me) => queryClient.setQueryData(meKey, me),
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
