"use client"

import { useQueryClient } from "@tanstack/react-query"
import { PageHeader } from "@/components/page-header"
import { SortableList } from "@/components/sortable-list"
import { EmptyState, Failed, ListLoading } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { api, call } from "@/lib/api"
import { kindLabels } from "@/lib/fields"
import { taskTypesKey, useCustomerDropdowns, useTaskTypes } from "@/lib/queries"
import type { TaskField, TaskType } from "@/lib/types"
import { useOwner } from "@/lib/use-owner"
import { inOrder, useReorder } from "@/lib/use-reorder"
import { DeleteButton } from "./delete-button"
import { AddFieldDialog, EditFieldDialog } from "./field-dialog"
import { SettingRow, settingList } from "./setting-row"

const back = { href: "/settings", label: "Sozlamalar" }

// TaskTypePage is one task type of the owner's company: the fields its form
// asks, in their order. The title, the deadline, the customer and the
// assignee are not among them: every task has those.
export function TaskTypePage({ id }: { id: number }) {
  const owner = useOwner()
  const companyId = owner ? owner.company.id : null
  const types = useTaskTypes(companyId)
  const dropdowns = useCustomerDropdowns(companyId)
  const queryClient = useQueryClient()
  const reorder = useReorder<TaskType[]>(
    taskTypesKey(companyId),
    (all, ids) => all.map((type) => (type.id === id ? { ...type, fields: inOrder(type.fields, ids) } : type)),
    (ids) => call(api.PUT("/app/task-types/{id}/fields/order", { params: { path: { id } }, body: { ids } })),
  )
  // What a change did shows once the types are asked for again.
  const refresh = () => queryClient.invalidateQueries({ queryKey: taskTypesKey(companyId) })

  if (!owner) return null
  if (!types.data) {
    return (
      <div className="space-y-5">
        <PageHeader title="Vazifa turi" back={back} />
        {types.isPending && <ListLoading rows={2} mark="none" />}
        {types.isError && <Failed error={types.error} onRetry={() => types.refetch()} />}
      </div>
    )
  }
  const type = types.data.find((candidate) => candidate.id === id)
  if (!type) {
    return (
      <PageHeader title="Tur topilmadi" description="Bu tur o'chirilgan yoki sizning kompaniyangizniki emas." back={back} />
    )
  }
  // A choice says where its options come from, once the dropdowns are known.
  const kindOf = (field: TaskField) => {
    const dropdown = dropdowns.data?.find((candidate) => candidate.id === field.dropdown_id)
    return dropdown ? `${kindLabels[field.kind]} · ${dropdown.name}` : kindLabels[field.kind]
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={type.name}
        description={`Vazifa turi · ${type.fields.length} ta maydon`}
        back={back}
        actions={
          <AddFieldDialog
            dropdowns={dropdowns.data ?? []}
            unique={false}
            add={async (field) => {
              // A task field is never told not to repeat: the API takes no such mark.
              await call(
                api.POST("/app/task-types/{id}/fields", {
                  params: { path: { id: type.id } },
                  body: { label: field.label, kind: field.kind, required: field.required, dropdown_id: field.dropdown_id },
                }),
              )
              await refresh()
            }}
          />
        }
      />
      {type.fields.length === 0 && (
        <EmptyState title="Bu turda maydon yo'q" description="Vazifa nomi, muddati, mijozi va mas'uli bilan qo'shiladi." />
      )}
      {type.fields.length > 0 && (
        <SortableList
          label="Maydonlar"
          items={type.fields}
          getId={(field) => String(field.id)}
          getLabel={(field) => field.label}
          onReorder={(ids) => reorder.mutate(ids.map(Number))}
          className={settingList}
          renderItem={(field, handle) => (
            <SettingRow
              handle={handle}
              title={field.label}
              detail={kindOf(field)}
              marks={field.required && <Badge variant="secondary">Majburiy</Badge>}
              actions={
                <>
                  <EditFieldDialog
                    field={field}
                    kind={kindOf(field)}
                    unique={false}
                    save={async (patch) => {
                      await call(
                        api.PATCH("/app/task-types/{id}/fields/{fieldId}", {
                          params: { path: { id: type.id, fieldId: field.id } },
                          body: { label: patch.label, required: patch.required },
                        }),
                      )
                      await refresh()
                    }}
                  />
                  <DeleteButton
                    label={`O'chirish: ${field.label}`}
                    title="Maydonni o'chirasizmi?"
                    description={`«${field.label}» maydoni formadan olib tashlanadi. Vazifalarda to'ldirilgan maydon o'chirilmaydi.`}
                    done="Maydon o'chirildi"
                    onDelete={async () => {
                      await call(
                        api.DELETE("/app/task-types/{id}/fields/{fieldId}", {
                          params: { path: { id: type.id, fieldId: field.id } },
                        }),
                      )
                      await refresh()
                    }}
                  />
                </>
              }
            />
          )}
        />
      )}
      <p className="px-1 text-sm text-pretty text-muted-foreground md:px-4">
        Nomi, muddat va mijoz har vazifada bor va majburiy, mas&apos;ul ixtiyoriy: ularni maydon qilib qo&apos;shish
        shart emas.
      </p>
    </div>
  )
}
