"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { EyeIcon, EyeOffIcon, PencilIcon } from "lucide-react"
import { toast } from "sonner"
import { ActionTooltip } from "@/components/action-tooltip"
import { PageHeader } from "@/components/page-header"
import { SortableList } from "@/components/sortable-list"
import { EmptyState, Failed, ListLoading } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { api, call } from "@/lib/api"
import { customerDropdownsKey, useCustomerDropdowns } from "@/lib/queries"
import type { CustomerDropdown, CustomerOption } from "@/lib/types"
import { useOwner } from "@/lib/use-owner"
import { inOrder, useReorder } from "@/lib/use-reorder"
import { cn } from "@/lib/utils"
import { AddOptionForm } from "./add-option-form"
import { DeleteButton } from "./delete-button"
import { NameDialog } from "./name-dialog"
import { iconAction, SettingRow, settingList } from "./setting-row"
import { settingsHref } from "./use-settings-tab"

const back = { href: settingsHref("dropdowns"), label: "Sozlamalar" }

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
  const reorder = useReorder<CustomerDropdown[]>(
    customerDropdownsKey(companyId),
    (all, ids) =>
      all.map((dropdown) => (dropdown.id === id ? { ...dropdown, options: inOrder(dropdown.options, ids) } : dropdown)),
    (ids) => call(api.PUT("/app/customer-dropdowns/{id}/options/order", { params: { path: { id } }, body: { ids } })),
  )

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
        <SortableList
          label="Variantlar"
          items={dropdown.options}
          getId={(option) => String(option.id)}
          getLabel={(option) => option.label}
          onReorder={(ids) => reorder.mutate(ids.map(Number))}
          className={settingList}
          renderItem={(option, handle) => (
            <SettingRow
              handle={handle}
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
                  <DeleteButton
                    label={`O'chirish: ${option.label}`}
                    title="Variantni o'chirasizmi?"
                    description={`«${option.label}» ro'yxatdan olib tashlanadi. Mijozlarda tanlangan variant o'chirilmaydi: uni nofaol qilish mumkin.`}
                    done="Variant o'chirildi"
                    onDelete={async () => {
                      await call(
                        api.DELETE("/app/customer-dropdowns/{id}/options/{optionId}", {
                          params: { path: { id: dropdown.id, optionId: option.id } },
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
