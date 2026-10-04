"use client"

import { PageHeader } from "@/components/page-header"
import { ListLoading } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { kindLabels, nameFieldOf } from "@/lib/customer-fields"
import { useCustomerTypes } from "@/lib/queries"
import { useOwner } from "@/lib/use-owner"
import { SettingRow, settingList } from "./setting-row"

const back = { href: "/settings", label: "Sozlamalar" }

// CustomerTypePage is one customer type of the owner's company: the fields
// its form asks, in their order. The phone is not among them: every
// customer has one. The first text field is the name a customer goes by.
export function CustomerTypePage({ id }: { id: number }) {
  const owner = useOwner()
  const types = useCustomerTypes(owner ? owner.company.id : null)

  if (!owner) return null
  const type = types.data?.find((candidate) => candidate.id === id)
  if (!type) {
    return (
      <div className="space-y-5">
        <PageHeader title="Mijoz turi" back={back} />
        {types.isPending && <ListLoading rows={2} mark="none" />}
      </div>
    )
  }
  const nameField = nameFieldOf(type)

  return (
    <div className="space-y-5">
      <PageHeader title={type.name} description={`Mijoz turi · ${type.fields.length} ta maydon`} back={back} />
      <ul aria-label="Maydonlar" className={settingList}>
        {type.fields.map((field) => (
          <li key={field.id}>
            <SettingRow
              title={field.label}
              detail={kindLabels[field.kind]}
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
            />
          </li>
        ))}
      </ul>
      <p className="px-1 text-sm text-pretty text-muted-foreground md:px-4">
        Telefon har doim bor va majburiy: uni maydon qilib qo&apos;shish shart emas. Birinchi matn maydoni
        ro&apos;yxatda mijoz nomi bo&apos;lib ko&apos;rinadi.
      </p>
    </div>
  )
}
