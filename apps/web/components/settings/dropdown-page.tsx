"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { ActionSheet } from "@/components/kit/action-sheet"
import { Foot, Group, Row, SectionHeading } from "@/components/kit/group"
import { OrderedRows } from "@/components/kit/ordered-rows"
import { BackLink, PageTitle } from "@/components/kit/page-title"
import { Failed, ListLoading, NotFound } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { api, call } from "@/lib/api"
import { can } from "@/lib/permissions"
import { customerDropdownsKey, useCustomerDropdowns } from "@/lib/queries"
import type { CustomerDropdown, CustomerOption, Permission } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { inOrder, useReorder } from "@/lib/use-reorder"
import { cn } from "@/lib/utils"
import { AddOptionForm } from "./add-option-form"
import { DeleteButton } from "./delete-button"
import { NameDialog } from "./name-dialog"

const back = { href: "/settings/dropdowns", label: "Dropdownlar" }

// Sheet is what is open over the page: an option's actions, an option being
// renamed or deleted, the dropdown being renamed or deleted.
type Sheet = { act: CustomerOption } | { rename: CustomerOption } | { remove: CustomerOption } | { renameDropdown: true } | { removeDropdown: true }

// DropdownPage is one dropdown of the owner's company: the options the
// choice fields that use it offer, in their order, for whoever may see the
// settings, as the prototype's page: each option a row (a turned-off one,
// no longer offered but kept on the records that chose it, marked) opening
// a sheet of its actions (renaming and turning off or on: settings.edit;
// deleting: settings.delete); the line under them adds one
// (settings.create); the «Tartiblash» mode orders them; the dropdown itself
// is renamed and deleted from rows under them.
export function DropdownPage({ id }: { id: number }) {
  const gate = usePermission("settings.view")
  const companyId = gate ? gate.company.id : null
  const allowed = (permission: Permission) => can(gate?.permissions, permission)
  const dropdowns = useCustomerDropdowns(companyId)
  const queryClient = useQueryClient()
  const router = useRouter()
  // What a change did shows once the dropdowns are asked for again.
  const refresh = () => queryClient.invalidateQueries({ queryKey: customerDropdownsKey(companyId) })
  const reorder = useReorder<CustomerDropdown[]>(
    customerDropdownsKey(companyId),
    (all, ids) => all.map((dropdown) => (dropdown.id === id ? { ...dropdown, options: inOrder(dropdown.options, ids) } : dropdown)),
    (ids) => call(api.PUT("/app/customer-dropdowns/{id}/options/order", { params: { path: { id } }, body: { ids } })),
  )
  // An option turned off is no longer offered; the records that chose it keep it.
  const toggle = useMutation({
    mutationFn: (option: CustomerOption) =>
      call(
        api.PATCH("/app/customer-dropdowns/{id}/options/{optionId}", {
          params: { path: { id, optionId: option.id } },
          body: { is_active: !option.is_active },
        }),
      ),
    onSuccess: async (changed) => {
      await refresh()
      toast.success(changed.is_active ? "Variant faollashtirildi" : "Variant nofaol qilindi")
    },
    onError: (error) => toast.error(error.message),
  })
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const close = (open: boolean) => !open && setSheet(null)

  if (!gate) return null
  if (!dropdowns.data) {
    return (
      <>
        <PageTitle title="Dropdown" back={back} />
        {dropdowns.isPending && <ListLoading rows={3} mark="none" />}
        {dropdowns.isError && <Failed error={dropdowns.error} onRetry={() => dropdowns.refetch()} />}
      </>
    )
  }
  const dropdown = dropdowns.data.find((candidate) => candidate.id === id)
  if (!dropdown) {
    return (
      <>
        <BackLink {...back} />
        <NotFound title="Dropdown topilmadi" description="Bu dropdown o'chirilgan yoki sizning kompaniyangizniki emas." />
      </>
    )
  }
  const optionPath = (option: CustomerOption) => ({ params: { path: { id: dropdown.id, optionId: option.id } } })
  const acting = sheet && "act" in sheet ? sheet.act : null
  const actions = (option: CustomerOption) => [
    ...(allowed("settings.edit")
      ? [
          { label: "Nomini o'zgartirish", onSelect: () => setSheet({ rename: option }) },
          { label: option.is_active ? "Nofaol qilish" : "Faollashtirish", onSelect: () => toggle.mutate(option) },
        ]
      : []),
    ...(allowed("settings.delete") ? [{ label: "O'chirish", danger: true, onSelect: () => setSheet({ remove: option }) }] : []),
  ]
  const acts = allowed("settings.edit") || allowed("settings.delete")

  return (
    <>
      <PageTitle title={dropdown.name} description={`Dropdown · ${dropdown.options.length} ta variant`} back={back} />
      {dropdown.options.length === 0 ? (
        <>
          <SectionHeading>Variantlar</SectionHeading>
          <Group>
            <div className="px-4 py-3">
              <p className="text-base font-medium">Hali variant yo&apos;q</p>
              <p className="mt-0.5 text-sm text-muted-foreground">Pastdagi satrga yozib, «Qo&apos;shish» ni bosing.</p>
            </div>
          </Group>
        </>
      ) : (
        <OrderedRows
          label="Variantlar"
          heading="Variantlar"
          items={dropdown.options}
          getId={(option) => String(option.id)}
          getLabel={(option) => option.label}
          onReorder={(ids) => reorder.mutate(ids.map(Number))}
          canOrder={allowed("settings.edit")}
          row={(option, handle) => {
            const off = !option.is_active && <Badge>Nofaol</Badge>
            const title = <span className={cn(!option.is_active && "text-muted-foreground")}>{option.label}</span>
            return handle ? (
              <Row compact media={handle} title={title} badge={off} />
            ) : (
              <Row compact onClick={acts ? () => setSheet({ act: option }) : undefined} title={title} badge={off} chevron={false} />
            )
          }}
        />
      )}
      {allowed("settings.create") && <AddOptionForm companyId={gate.company.id} dropdownId={dropdown.id} />}
      <Foot className="-mt-4">Nofaol variant yangi tanlovlarda chiqmaydi, eski yozuvlarda qoladi.</Foot>
      {(allowed("settings.edit") || allowed("settings.delete")) && (
        <Group>
          {allowed("settings.edit") && <Row variant="accent" onClick={() => setSheet({ renameDropdown: true })} title="Nomini o'zgartirish" />}
          {allowed("settings.delete") && <Row variant="danger" onClick={() => setSheet({ removeDropdown: true })} title="Dropdownni o'chirish" />}
        </Group>
      )}
      <ActionSheet open={acting !== null} onOpenChange={close} title={acting?.label} items={acting ? actions(acting) : []} />
      {sheet && "rename" in sheet && (
        <NameDialog
          title="Variant nomini o'zgartirish"
          description="Bu variantni tanlagan mijozlarda ham yangi nom ko'rinadi."
          initial={sheet.rename.label}
          submit="Saqlash"
          done="Variant nomi o'zgartirildi"
          open
          onOpenChange={close}
          onSubmit={async (label) => {
            await call(api.PATCH("/app/customer-dropdowns/{id}/options/{optionId}", { ...optionPath(sheet.rename), body: { label } }))
            await refresh()
          }}
        />
      )}
      {sheet && "remove" in sheet && (
        <DeleteButton
          label={`O'chirish: ${sheet.remove.label}`}
          title="Variantni o'chirasizmi?"
          description={`«${sheet.remove.label}» ro'yxatdan olib tashlanadi. Mijozlarda tanlangan variant o'chirilmaydi: uni nofaol qilish mumkin.`}
          done="Variant o'chirildi"
          onDelete={async () => {
            await call(api.DELETE("/app/customer-dropdowns/{id}/options/{optionId}", optionPath(sheet.remove)))
            await refresh()
          }}
          open
          onOpenChange={close}
        />
      )}
      {sheet && "renameDropdown" in sheet && (
        <NameDialog
          title="Dropdown nomini o'zgartirish"
          description="Variantlari va uni ishlatadigan maydonlar o'zgarmaydi."
          initial={dropdown.name}
          submit="Saqlash"
          done="Dropdown nomi o'zgartirildi"
          open
          onOpenChange={close}
          onSubmit={async (name) => {
            await call(api.PATCH("/app/customer-dropdowns/{id}", { params: { path: { id: dropdown.id } }, body: { name } }))
            await refresh()
          }}
        />
      )}
      {sheet && "removeDropdown" in sheet && (
        <DeleteButton
          label={`O'chirish: ${dropdown.name}`}
          title="Dropdownni o'chirasizmi?"
          description={`«${dropdown.name}» va uning variantlari o'chadi. Maydonga ulangan dropdown o'chirilmaydi.`}
          done="Dropdown o'chirildi"
          onDelete={() => call(api.DELETE("/app/customer-dropdowns/{id}", { params: { path: { id: dropdown.id } } }))}
          onDone={() => {
            router.replace(back.href)
            refresh()
          }}
          open
          onOpenChange={close}
        />
      )}
    </>
  )
}
