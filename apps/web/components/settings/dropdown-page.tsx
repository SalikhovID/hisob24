"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { EyeIcon, EyeOffIcon, PencilIcon } from "lucide-react"
import { toast } from "sonner"
import { ActionTooltip } from "@/components/action-tooltip"
import { PageHeader } from "@/components/page-header"
import { EmptyState, Failed, ListLoading } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { api, call } from "@/lib/api"
import { customerDropdownsKey, useCustomerDropdowns } from "@/lib/queries"
import type { CustomerOption } from "@/lib/types"
import { useOwner } from "@/lib/use-owner"
import { cn } from "@/lib/utils"
import { AddOptionForm } from "./add-option-form"
import { NameDialog } from "./name-dialog"
import { iconAction, SettingRow, settingList } from "./setting-row"

const back = { href: "/settings", label: "Sozlamalar" }

// DropdownPage is one dropdown of the owner's company: the options the
// choice fields that use it offer, in their order. An option that is turned
// off is no longer offered, but stays on the customers who chose it.
export function DropdownPage({ id }: { id: number }) {
  const owner = useOwner()
  const companyId = owner ? owner.company.id : null
  const dropdowns = useCustomerDropdowns(companyId)
  const queryClient = useQueryClient()
  // What a change did shows once the dropdowns are asked for again.
  const refresh = () => queryClient.invalidateQueries({ queryKey: customerDropdownsKey(companyId) })

  if (!owner) return null
  if (!dropdowns.data) {
    return (
      <div className="space-y-5">
        <PageHeader title="Dropdown" back={back} />
        {dropdowns.isPending && <ListLoading rows={3} mark="none" />}
        {dropdowns.isError && <Failed error={dropdowns.error} onRetry={() => dropdowns.refetch()} />}
      </div>
    )
  }
  const dropdown = dropdowns.data.find((candidate) => candidate.id === id)
  if (!dropdown) {
    return (
      <PageHeader
        title="Dropdown topilmadi"
        description="Bu dropdown o'chirilgan yoki sizning kompaniyangizniki emas."
        back={back}
      />
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader title={dropdown.name} description={`Dropdown · ${dropdown.options.length} ta variant`} back={back} />
      {dropdown.options.length === 0 && (
        <EmptyState title="Hali variant yo'q" description="Pastdagi satrga yozib, Enter bosing." />
      )}
      {dropdown.options.length > 0 && (
        <ul aria-label="Variantlar" className={settingList}>
          {dropdown.options.map((option) => (
            <li key={option.id}>
              <SettingRow
                title={<span className={cn(!option.is_active && "text-muted-foreground")}>{option.label}</span>}
                marks={!option.is_active && <Badge variant="outline">Nofaol</Badge>}
                actions={
                  <>
                  <NameDialog
                    title="Variant nomini o'zgartirish"
                    description="Bu variantni tanlagan mijozlarda ham yangi nom ko'rinadi."
                    initial={option.label}
                    submit="Saqlash"
                    done="Variant nomi o'zgartirildi"
                    tooltip="Nomini o'zgartirish"
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon"
                        className={iconAction}
                        aria-label={`Nomini o'zgartirish: ${option.label}`}
                      >
                        <PencilIcon />
                      </Button>
                    }
                    onSubmit={async (label) => {
                      await call(
                        api.PATCH("/app/customer-dropdowns/{id}/options/{optionId}", {
                          params: { path: { id: dropdown.id, optionId: option.id } },
                          body: { label },
                        }),
                      )
                      await refresh()
                    }}
                  />
                  <ToggleOptionButton dropdownId={dropdown.id} option={option} onDone={refresh} />
                  </>
                }
              />
            </li>
          ))}
        </ul>
      )}
      <AddOptionForm companyId={owner.company.id} dropdownId={dropdown.id} />
    </div>
  )
}

// ToggleOptionButton turns an option off, or on again. Off, it is no longer
// offered when a customer is added; the customers who chose it keep it.
function ToggleOptionButton({
  dropdownId,
  option,
  onDone,
}: {
  dropdownId: number
  option: CustomerOption
  onDone: () => Promise<unknown>
}) {
  const toggle = useMutation({
    mutationFn: () =>
      call(
        api.PATCH("/app/customer-dropdowns/{id}/options/{optionId}", {
          params: { path: { id: dropdownId, optionId: option.id } },
          body: { is_active: !option.is_active },
        }),
      ),
    onSuccess: async (changed) => {
      await onDone()
      toast.success(changed.is_active ? "Variant faollashtirildi" : "Variant nofaol qilindi")
    },
    onError: (error) => toast.error(error.message),
  })
  const verb = option.is_active ? "Nofaol qilish" : "Faollashtirish"
  return (
    <ActionTooltip label={verb}>
      <Button
        variant="ghost"
        size="icon"
        className={iconAction}
        aria-label={`${verb}: ${option.label}`}
        disabled={toggle.isPending}
        onClick={() => toggle.mutate()}
      >
        {option.is_active ? <EyeOffIcon /> : <EyeIcon />}
      </Button>
    </ActionTooltip>
  )
}
