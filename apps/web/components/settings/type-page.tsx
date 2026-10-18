"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Foot, Group, Row, SectionHeading } from "@/components/kit/group"
import { OrderedRows } from "@/components/kit/ordered-rows"
import { BackLink, PageTitle, PlusButton } from "@/components/kit/page-title"
import { Failed, ListLoading, NotFound } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { api, call } from "@/lib/api"
import { nameFieldOf } from "@/lib/customers"
import { kindLabels } from "@/lib/fields"
import { can } from "@/lib/permissions"
import { customerTypesKey, orderTypesKey, useCustomerDropdowns, useCustomerTypes, useOrderTypes } from "@/lib/queries"
import type { CustomerField, CustomerType, Permission, OrderField, OrderType } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { inOrder, useReorder } from "@/lib/use-reorder"
import { DeleteDialog } from "./delete-button"
import { AddFieldSheet, EditFieldSheet } from "./field-sheet"
import { NameDialog } from "./name-dialog"
import { moving } from "@/lib/moves"

type Field = CustomerField | OrderField
type Type = CustomerType | OrderType

// The words of each kind of type, and where its page leads back to.
const words = {
  customer: {
    what: "Mijoz turi",
    back: { href: "/settings/customer-types", label: "Mijoz turlari" },
    noFields: "Mijoz faqat telefon raqami bilan qo'shiladi.",
    foot: "Telefon har mijozda bor va majburiy: uni maydon qilib qo'shish shart emas. Birinchi matn maydoni ro'yxatda mijoz nomi bo'lib ko'rinadi.",
    rename: { title: "Tur nomini o'zgartirish", description: "Turning maydonlari va shu turdagi mijozlar o'zgarmaydi.", done: "Tur nomi o'zgartirildi" },
    remove: { title: "Turni o'chirasizmi?", done: "Tur o'chirildi", stops: "Mijozi bor tur o'chirilmaydi." },
    fieldStops: "Mijozlarda to'ldirilgan maydon o'chirilmaydi.",
  },
  order: {
    what: "Vazifa turi",
    back: { href: "/settings/task-types", label: "Vazifa turlari" },
    noFields: "Vazifa nomi, muddati, mijozi va mas'uli bilan qo'shiladi.",
    foot: "Nomi, muddat va mijoz har vazifada bor va majburiy, mas'ul ixtiyoriy: ularni maydon qilib qo'shish shart emas.",
    rename: { title: "Vazifa turi nomini o'zgartirish", description: "Turning maydonlari va shu turdagi vazifalar o'zgarmaydi.", done: "Vazifa turi nomi o'zgartirildi" },
    remove: { title: "Vazifa turini o'chirasizmi?", done: "Vazifa turi o'chirildi", stops: "Vazifasi bor tur o'chirilmaydi." },
    fieldStops: "Vazifalarda to'ldirilgan maydon o'chirilmaydi.",
  },
} as const

// Sheet is what is open over the page: a field being added, changed or
// deleted, the type being renamed or deleted.
type Sheet = { add: true } | { edit: Field } | { removeField: Field } | { rename: true } | { removeType: true }

// TypePage is one type of the owner's company, a customer type or an order
// type (logic/customers.md, logic/tasks.md), for whoever may see the
// settings, as the prototype's page: its fields in their order, each a row
// by name with its marks (the customer's name, required, unique) and its
// kind under it, opening its sheet (settings.edit: the name and the marks;
// settings.delete: the way to delete it); the plus adds a field
// (settings.create); the «Tartiblash» mode orders them (settings.edit); the
// type itself is renamed and deleted from rows under them. The customer's
// phone, the order's title, deadline, customer and assignee are not among
// the fields: every one has them.
export function TypePage({ kind, id }: { kind: "customer" | "order"; id: number }) {
  const gate = usePermission("settings.view")
  const companyId = gate ? gate.company.id : null
  const allowed = (permission: Permission) => can(gate?.permissions, permission)
  const customerTypes = useCustomerTypes(kind === "customer" ? companyId : null)
  const orderTypes = useOrderTypes(kind === "order" ? companyId : null)
  const types = kind === "customer" ? customerTypes : orderTypes
  const dropdowns = useCustomerDropdowns(companyId)
  const queryKey = kind === "customer" ? customerTypesKey(companyId) : orderTypesKey(companyId)
  const queryClient = useQueryClient()
  const router = useRouter()
  const reorder = useReorder<Type[]>(
    queryKey,
    (all, ids) => all.map((type) => (type.id === id ? ({ ...type, fields: inOrder<Field>(type.fields, ids) } as Type) : type)),
    (ids) =>
      kind === "customer"
        ? call(api.PUT("/app/customer-types/{id}/fields/order", { params: { path: { id } }, body: { ids } }))
        : call(api.PUT("/app/order-types/{id}/fields/order", { params: { path: { id } }, body: { ids } })),
  )
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const w = words[kind]
  // What a change did shows once the types are asked for again.
  const refresh = () => queryClient.invalidateQueries({ queryKey })
  const close = (open: boolean) => !open && setSheet(null)

  if (!gate) return null
  const list: Type[] | undefined = types.data
  if (!list) {
    return (
      <>
        <PageTitle title={w.what} back={w.back} />
        {types.isPending && <ListLoading rows={2} mark="none" />}
        {types.isError && <Failed error={types.error} onRetry={() => types.refetch()} />}
      </>
    )
  }
  const type = list.find((candidate) => candidate.id === id)
  if (!type) {
    return (
      <>
        <BackLink {...w.back} />
        <NotFound title="Tur topilmadi" description="Bu tur o'chirilgan yoki sizning kompaniyangizniki emas." />
      </>
    )
  }
  const nameField = kind === "customer" ? nameFieldOf(type as CustomerType) : undefined
  // A choice says where its options come from, once the dropdowns are known.
  const kindOf = (field: Field) => {
    const dropdown = dropdowns.data?.find((candidate) => candidate.id === field.dropdown_id)
    return dropdown ? `${kindLabels[field.kind]} · ${dropdown.name}` : kindLabels[field.kind]
  }
  const openField = (field: Field) => (allowed("settings.edit") ? () => setSheet({ edit: field }) : allowed("settings.delete") ? () => setSheet({ removeField: field }) : undefined)
  const fieldPath = (field: Field) => ({ params: { path: { id: type.id, fieldId: field.id } } })
  const removing = sheet && "removeField" in sheet ? sheet.removeField : sheet && "edit" in sheet ? sheet.edit : null

  return (
    <>
      <PageTitle
        title={type.name}
        description={`${w.what} · ${type.fields.length} ta maydon`}
        back={w.back}
        action={allowed("settings.create") && <PlusButton label="Maydon qo'shish" onClick={() => setSheet({ add: true })} />}
      />
      {type.fields.length === 0 ? (
        <>
          <SectionHeading>Maydonlar</SectionHeading>
          <Group>
            <div className="px-4 py-3">
              <p className="text-base font-medium">Bu turda maydon yo&apos;q</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{w.noFields}</p>
            </div>
          </Group>
        </>
      ) : (
        <OrderedRows
          label="Maydonlar"
          heading="Maydonlar"
          items={type.fields as Field[]}
          getId={(field) => String(field.id)}
          getLabel={(field) => field.label}
          onReorder={(ids) => reorder.mutate(ids.map(Number))}
          canOrder={allowed("settings.edit")}
          row={(field, handle) => {
            const marks = (
              <>
                {field.id === nameField?.id && <Badge variant="accent">Mijoz nomi</Badge>}
                {field.required && <Badge>Majburiy</Badge>}
                {"is_unique" in field && field.is_unique && <Badge>Takrorlanmas</Badge>}
              </>
            )
            return handle ? (
              <Row compact media={handle} title={field.label} badge={marks} sub={kindOf(field)} />
            ) : (
              <Row onClick={openField(field)} title={field.label} badge={marks} sub={kindOf(field)} chevron={openField(field) !== undefined} />
            )
          }}
        />
      )}
      <Foot className="-mt-4">{w.foot}</Foot>
      {(allowed("settings.edit") || allowed("settings.delete")) && (
        <Group>
          {allowed("settings.edit") && <Row variant="accent" onClick={() => setSheet({ rename: true })} title="Nomini o'zgartirish" />}
          {allowed("settings.delete") && <Row variant="danger" onClick={() => setSheet({ removeType: true })} title="Turni o'chirish" />}
        </Group>
      )}
      {sheet && "add" in sheet && (
        <AddFieldSheet
          dropdowns={dropdowns.data ?? []}
          unique={kind === "customer"}
          add={async (field) => {
            if (kind === "customer") await call(api.POST("/app/customer-types/{id}/fields", { params: { path: { id: type.id } }, body: field }))
            // An order field is never told not to repeat: the API takes no such mark.
            else
              await call(
                api.POST("/app/order-types/{id}/fields", {
                  params: { path: { id: type.id } },
                  body: { label: field.label, kind: field.kind, required: field.required, dropdown_id: field.dropdown_id },
                }),
              )
            await refresh()
          }}
          open
          onOpenChange={close}
        />
      )}
      {sheet && "edit" in sheet && (
        <EditFieldSheet
          field={sheet.edit}
          kind={kindOf(sheet.edit)}
          unique={kind === "customer"}
          save={async (patch) => {
            if (kind === "customer") await call(api.PATCH("/app/customer-types/{id}/fields/{fieldId}", { ...fieldPath(sheet.edit), body: patch }))
            else await call(api.PATCH("/app/order-types/{id}/fields/{fieldId}", { ...fieldPath(sheet.edit), body: { label: patch.label, required: patch.required } }))
            await refresh()
          }}
          onDelete={allowed("settings.delete") ? () => setSheet({ removeField: sheet.edit }) : undefined}
          open
          onOpenChange={close}
        />
      )}
      {removing && sheet && "removeField" in sheet && (
        <DeleteDialog
          title="Maydonni o'chirasizmi?"
          description={`«${removing.label}» maydoni formadan olib tashlanadi. ${w.fieldStops}`}
          done="Maydon o'chirildi"
          onDelete={async () => {
            if (kind === "customer") await call(api.DELETE("/app/customer-types/{id}/fields/{fieldId}", fieldPath(removing)))
            else await call(api.DELETE("/app/order-types/{id}/fields/{fieldId}", fieldPath(removing)))
            await refresh()
          }}
          open
          onOpenChange={close}
        />
      )}
      {sheet && "rename" in sheet && (
        <NameDialog
          title={w.rename.title}
          description={w.rename.description}
          initial={type.name}
          submit="Saqlash"
          done={w.rename.done}
          open
          onOpenChange={close}
          onSubmit={async (name) => {
            if (kind === "customer") await call(api.PATCH("/app/customer-types/{id}", { params: { path: { id: type.id } }, body: { name } }))
            else await call(api.PATCH("/app/order-types/{id}", { params: { path: { id: type.id } }, body: { name } }))
            await refresh()
          }}
        />
      )}
      {sheet && "removeType" in sheet && (
        <DeleteDialog
          title={w.remove.title}
          description={`«${type.name}» turi va uning maydonlari o'chadi. ${w.remove.stops}`}
          done={w.remove.done}
          onDelete={async () => {
            if (kind === "customer") await call(api.DELETE("/app/customer-types/{id}", { params: { path: { id: type.id } } }))
            else await call(api.DELETE("/app/order-types/{id}", { params: { path: { id: type.id } } }))
          }}
          onDone={() => {
            moving("back", () => router.replace(w.back.href))
            refresh()
          }}
          open
          onOpenChange={close}
        />
      )}
    </>
  )
}
