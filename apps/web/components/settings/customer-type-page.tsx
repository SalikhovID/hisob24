"use client"

import { useQueryClient } from "@tanstack/react-query"
import { PageHeader } from "@/components/page-header"
import { SortableList } from "@/components/sortable-list"
import { EmptyState, Failed, ListLoading } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { api, call } from "@/lib/api"
import { kindLabels, nameFieldOf } from "@/lib/customer-fields"
import { customerTypesKey, useCustomerDropdowns, useCustomerTypes } from "@/lib/queries"
import type { CustomerField, CustomerType } from "@/lib/types"
import { useOwner } from "@/lib/use-owner"
import { inOrder, useReorder } from "@/lib/use-reorder"
import { DeleteButton } from "./delete-button"
import { AddFieldDialog, EditFieldDialog } from "./field-dialog"
import { SettingRow, settingList } from "./setting-row"

const back = { href: "/settings", label: "Sozlamalar" }

// CustomerTypePage is one customer type of the owner's company: the fields
// its form asks, in their order. The phone is not among them: every
// customer has one. The first text field is the name a customer goes by.
export function CustomerTypePage({ id }: { id: number }) {
  const owner = useOwner()
  const companyId = owner ? owner.company.id : null
  const types = useCustomerTypes(companyId)
  const dropdowns = useCustomerDropdowns(companyId)
  const queryClient = useQueryClient()
  const reorder = useReorder<CustomerType[]>(
    customerTypesKey(companyId),
    (all, ids) => all.map((type) => (type.id === id ? { ...type, fields: inOrder(type.fields, ids) } : type)),
    (ids) => call(api.PUT("/app/customer-types/{id}/fields/order", { params: { path: { id } }, body: { ids } })),
  )

  if (!owner) return null
  if (!types.data) {
    return (
      <div className="space-y-5">
        <PageHeader title="Mijoz turi" back={back} />
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
  const nameField = nameFieldOf(type)
  // A choice says where its options come from, once the dropdowns are known.
  const kindOf = (field: CustomerField) => {
    const dropdown = dropdowns.data?.find((candidate) => candidate.id === field.dropdown_id)
    return dropdown ? `${kindLabels[field.kind]} · ${dropdown.name}` : kindLabels[field.kind]
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={type.name}
        description={`Mijoz turi · ${type.fields.length} ta maydon`}
        back={back}
        actions={<AddFieldDialog companyId={owner.company.id} typeId={type.id} dropdowns={dropdowns.data ?? []} />}
      />
      {type.fields.length === 0 && (
        <EmptyState title="Bu turda maydon yo'q" description="Mijoz faqat telefon raqami bilan qo'shiladi." />
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
              marks={
                <>
                  {field.id === nameField?.id && (
                    <Badge variant="secondary" className="bg-primary/10 dark:bg-primary/15">
                      Mijoz nomi
                    </Badge>
                  )}
                  {field.required && <Badge variant="secondary">Majburiy</Badge>}
                  {field.is_unique && <Badge variant="outline">Takrorlanmas</Badge>}
                </>
              }
              actions={
                <>
                  <EditFieldDialog companyId={owner.company.id} typeId={type.id} field={field} kind={kindOf(field)} />
                  <DeleteButton
                    label={`O'chirish: ${field.label}`}
                    title="Maydonni o'chirasizmi?"
                    description={`«${field.label}» maydoni formadan olib tashlanadi. Mijozlarda to'ldirilgan maydon o'chirilmaydi.`}
                    done="Maydon o'chirildi"
                    onDelete={async () => {
                      await call(
                        api.DELETE("/app/customer-types/{id}/fields/{fieldId}", {
                          params: { path: { id: type.id, fieldId: field.id } },
                        }),
                      )
                      await queryClient.invalidateQueries({ queryKey: customerTypesKey(owner.company.id) })
                    }}
                  />
                </>
              }
            />
          )}
        />
      )}
      <p className="px-1 text-sm text-pretty text-muted-foreground md:px-4">
        Telefon har doim bor va majburiy: uni maydon qilib qo&apos;shish shart emas. Birinchi matn maydoni
        ro&apos;yxatda mijoz nomi bo&apos;lib ko&apos;rinadi.
      </p>
    </div>
  )
}
