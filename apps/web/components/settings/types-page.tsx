"use client"

import { useQueryClient } from "@tanstack/react-query"
import { TagIcon } from "lucide-react"
import { useState } from "react"
import { Row } from "@/components/kit/group"
import { OrderedRows } from "@/components/kit/ordered-rows"
import { PageTitle, PlusButton } from "@/components/kit/page-title"
import { EmptyState, Failed, ListLoading } from "@/components/states"
import { api, call } from "@/lib/api"
import { can } from "@/lib/permissions"
import { customerTypesKey, taskTypesKey, useCustomerTypes, useTaskTypes } from "@/lib/queries"
import type { CustomerType, Permission, TaskType } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { inOrder, useReorder } from "@/lib/use-reorder"
import { NameDialog } from "./name-dialog"

// The words of each kind of type: what the page, its plus and its sheet say.
const words = {
  customer: {
    title: "Mijoz turlari",
    description: "Mijoz qo'shishda tanlanadi. Har turning o'z maydonlari bor.",
    add: "Tur qo'shish",
    addNote: "Masalan: Jismoniy, Yuridik. Maydonlari tur sahifasida qo'shiladi.",
    example: "Masalan, Yuridik",
    added: "Tur qo'shildi",
    none: "Hali tur yo'q",
    needed: "Mijoz qo'shish uchun kamida bitta tur kerak.",
    href: (id: number) => `/settings/customer-types/${id}`,
  },
  task: {
    title: "Vazifa turlari",
    description: "Vazifa qo'shishda tanlanadi. Har turning o'z maydonlari bor.",
    add: "Vazifa turi qo'shish",
    addNote: "Masalan: Buyurtma, Shikoyat. Maydonlari tur sahifasida qo'shiladi.",
    example: "Masalan, Buyurtma",
    added: "Vazifa turi qo'shildi",
    none: "Hali vazifa turi yo'q",
    needed: "Vazifa qo'shish uchun kamida bitta tur kerak.",
    href: (id: number) => `/settings/task-types/${id}`,
  },
} as const

// TypesPage is the company's customer types, or its task types, in the
// order the owner put them in (the order of the type chips when a customer
// or a task is added), for whoever may see the settings, as the prototype's
// page: each type a row by name with its fields under it, leading to its
// page; the plus adds one in a sheet (settings.create); the «Tartiblash»
// mode puts them in order (settings.edit).
export function TypesPage({ kind }: { kind: "customer" | "task" }) {
  const gate = usePermission("settings.view")
  const companyId = gate?.company.id ?? null
  const allowed = (permission: Permission) => can(gate?.permissions, permission)
  const customerTypes = useCustomerTypes(kind === "customer" ? companyId : null)
  const taskTypes = useTaskTypes(kind === "task" ? companyId : null)
  const types = kind === "customer" ? customerTypes : taskTypes
  const queryKey = kind === "customer" ? customerTypesKey(companyId) : taskTypesKey(companyId)
  const queryClient = useQueryClient()
  const reorder = useReorder<(CustomerType | TaskType)[]>(queryKey, inOrder, (ids) =>
    kind === "customer" ? call(api.PUT("/app/customer-types/order", { body: { ids } })) : call(api.PUT("/app/order-types/order", { body: { ids } })),
  )
  const [adding, setAdding] = useState(false)
  const w = words[kind]

  if (!gate) return null
  const list: (CustomerType | TaskType)[] | undefined = types.data
  return (
    <>
      <PageTitle
        title={w.title}
        description={w.description}
        back={{ href: "/settings", label: "Sozlamalar" }}
        action={allowed("settings.create") && <PlusButton label={w.add} onClick={() => setAdding(true)} />}
      />
      {types.isPending && <ListLoading rows={2} mark="none" />}
      {types.isError && <Failed error={types.error} onRetry={() => types.refetch()} />}
      {list?.length === 0 && <EmptyState icon={TagIcon} title={w.none} description={w.needed} />}
      {list && list.length > 0 && (
        <OrderedRows
          label={w.title}
          heading={`${list.length} ta tur`}
          items={list}
          getId={(type) => String(type.id)}
          getLabel={(type) => type.name}
          onReorder={(ids) => reorder.mutate(ids.map(Number))}
          canOrder={allowed("settings.edit")}
          row={(type, handle) => {
            const fields = type.fields.map((field) => field.label).join(", ") || "Maydon yo'q"
            return handle ? <Row compact media={handle} title={type.name} sub={fields} /> : <Row href={w.href(type.id)} title={type.name} sub={fields} />
          }}
        />
      )}
      {adding && companyId !== null && (
        <NameDialog
          title={w.add}
          description={w.addNote}
          placeholder={w.example}
          submit="Qo'shish"
          done={w.added}
          open
          onOpenChange={(open) => !open && setAdding(false)}
          onSubmit={async (name) => {
            if (kind === "customer") await call(api.POST("/app/customer-types", { body: { name } }))
            else await call(api.POST("/app/order-types", { body: { name } }))
            await queryClient.invalidateQueries({ queryKey })
          }}
        />
      )}
    </>
  )
}
