"use client"

import { useQueryClient } from "@tanstack/react-query"
import { ListIcon } from "lucide-react"
import { useState } from "react"
import { Group, Row, SectionHeading } from "@/components/kit/group"
import { PageTitle, PlusButton } from "@/components/kit/page-title"
import { EmptyState, Failed, ListLoading } from "@/components/states"
import { api, call } from "@/lib/api"
import { can } from "@/lib/permissions"
import { customerDropdownsKey, useCustomerDropdowns } from "@/lib/queries"
import type { Permission } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { NameDialog } from "./name-dialog"

// DropdownsPage is the company's dropdowns, in the order they were made
// (the choice fields of the customers and the orders take their options from
// them), for whoever may see the settings, as the prototype's page: each a
// row by name with its options under it, leading to its page; the plus adds
// one in a sheet (settings.create).
export function DropdownsPage() {
  const gate = usePermission("settings.view")
  const companyId = gate?.company.id ?? null
  const allowed = (permission: Permission) => can(gate?.permissions, permission)
  const dropdowns = useCustomerDropdowns(companyId)
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)

  if (!gate) return null
  const list = dropdowns.data
  return (
    <>
      <PageTitle
        title="Dropdownlar"
        description="Tanlov maydonlari variantlarni shu yerdan oladi. Mijoz va buyurtma maydonlari uchun umumiy."
        back={{ href: "/settings", label: "Sozlamalar" }}
        action={allowed("settings.create") && <PlusButton label="Dropdown qo'shish" onClick={() => setAdding(true)} />}
      />
      {dropdowns.isPending && <ListLoading rows={2} mark="none" />}
      {dropdowns.isError && <Failed error={dropdowns.error} onRetry={() => dropdowns.refetch()} />}
      {list?.length === 0 && (
        <EmptyState icon={ListIcon} title="Hali dropdown yo'q" description="Dropdown, radio va checkbox maydonlari variantlarni dropdowndan oladi." />
      )}
      {list && list.length > 0 && (
        <>
          <SectionHeading>{list.length} ta dropdown</SectionHeading>
          <Group label="Dropdownlar">
            {list.map((dropdown) => (
              <Row
                key={dropdown.id}
                href={`/settings/dropdowns/${dropdown.id}`}
                title={dropdown.name}
                sub={dropdown.options.map((option) => option.label).join(", ") || "Variant yo'q"}
              />
            ))}
          </Group>
        </>
      )}
      {adding && (
        <NameDialog
          title="Dropdown qo'shish"
          description="Masalan: Manba. Variantlari dropdown sahifasida qo'shiladi."
          placeholder="Masalan, Manba"
          submit="Qo'shish"
          done="Dropdown qo'shildi"
          open
          onOpenChange={(open) => !open && setAdding(false)}
          onSubmit={async (name) => {
            await call(api.POST("/app/customer-dropdowns", { body: { name } }))
            await queryClient.invalidateQueries({ queryKey: customerDropdownsKey(companyId) })
          }}
        />
      )}
    </>
  )
}
