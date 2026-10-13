"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"
import { ActionSheet } from "@/components/kit/action-sheet"
import { Foot, Group, Row, SectionHeading } from "@/components/kit/group"
import { OrderedRows } from "@/components/kit/ordered-rows"
import { PageTitle, PlusButton } from "@/components/kit/page-title"
import { Segmented } from "@/components/kit/segmented"
import { Failed, ListLoading } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { api, call } from "@/lib/api"
import { can } from "@/lib/permissions"
import { financeCategoriesKey, useFinanceCategories } from "@/lib/queries"
import type { FinanceCategory, FinanceKind, Permission } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { inOrder, useReorder } from "@/lib/use-reorder"
import { cn } from "@/lib/utils"
import { DeleteDialog } from "./delete-button"
import { NameDialog } from "./name-dialog"

// The words of each kind: what its list is called and what its rows are for.
const words: Record<FinanceKind, { title: string; foot: string; noun: string; example: string; empty: string }> = {
  expense: {
    title: "Xarajat kategoriyalari",
    foot: "Xarajat kiritishda tanlanadi: ijara, kommunal, maosh.",
    noun: "Xarajat kategoriyasi",
    example: "Masalan, Ijara",
    empty: "Xarajat kiritish uchun kamida bitta kategoriya kerak.",
  },
  income: {
    title: "Kirim kategoriyalari",
    foot: "Sotuvdan tashqari kirimlarda tanlanadi: boshqa kirim, foiz.",
    noun: "Kirim kategoriyasi",
    example: "Masalan, Foiz",
    empty: "Kirim kiritish uchun kamida bitta kategoriya kerak.",
  },
}

// Sheet is what is open over the page: a category being added, its
// actions, a category being renamed or deleted.
type Sheet = { add: true } | { act: FinanceCategory } | { rename: FinanceCategory } | { remove: FinanceCategory }

// FinanceCategoriesPage is the finance categories (logic/finance.md, section
// 6), for whoever may see the settings, as the prototype's page: the kind
// (expense or income) segmented; the kind's categories in the order the
// owner put them in, each a row (one turned off marked) opening a sheet of
// its actions (renaming, turning off and on: settings.edit; deleting:
// settings.delete); the plus adds one of the kind (settings.create); the
// «Tartiblash» mode orders them (settings.edit).
export function FinanceCategoriesPage() {
  const gate = usePermission("settings.view")
  const companyId = gate?.company.id ?? null
  const allowed = (permission: Permission) => can(gate?.permissions, permission)
  const [kind, setKind] = useState<FinanceKind>("expense")
  const categories = useFinanceCategories(companyId, kind)
  const queryClient = useQueryClient()
  const queryKey = financeCategoriesKey(companyId, kind)
  // What a change did shows once the list is asked for again.
  const refresh = () => queryClient.invalidateQueries({ queryKey })
  const reorder = useReorder<FinanceCategory[]>(queryKey, inOrder, (ids) => call(api.PUT("/app/finance-categories/order", { body: { kind, ids } })))
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const close = (open: boolean) => !open && setSheet(null)
  const w = words[kind]

  const setActive = async (category: FinanceCategory, active: boolean) => {
    try {
      await call(api.PATCH("/app/finance-categories/{id}", { params: { path: { id: category.id } }, body: { is_active: active } }))
      await refresh()
      toast.success(active ? "Kategoriya faollashtirildi" : "Kategoriya nofaol qilindi")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }
  const actions = (category: FinanceCategory) => [
    ...(allowed("settings.edit")
      ? [
          { label: "Nomini o'zgartirish", onSelect: () => setSheet({ rename: category }) },
          { label: category.is_active ? "Nofaol qilish" : "Faollashtirish", onSelect: () => setActive(category, !category.is_active) },
        ]
      : []),
    ...(allowed("settings.delete") ? [{ label: "O'chirish", danger: true, onSelect: () => setSheet({ remove: category }) }] : []),
  ]
  const acts = allowed("settings.edit") || allowed("settings.delete")

  if (!gate || companyId === null) return null
  const acting = sheet && "act" in sheet ? sheet.act : null
  const list = categories.data
  return (
    <>
      <PageTitle
        title="Moliya kategoriyalari"
        description="Xarajat va kirimlar kategoriyasi bilan kiritiladi."
        back={{ href: "/settings", label: "Sozlamalar" }}
        action={allowed("settings.create") && <PlusButton label="Kategoriya qo'shish" onClick={() => setSheet({ add: true })} />}
      />
      <Segmented
        label="Tur"
        value={kind}
        onChange={(next) => setKind(next === "income" ? "income" : "expense")}
        options={[
          { value: "expense", label: "Xarajat" },
          { value: "income", label: "Kirim" },
        ]}
      />
      {categories.isPending && <ListLoading rows={2} mark="none" />}
      {categories.isError && <Failed error={categories.error} onRetry={() => categories.refetch()} />}
      {list?.length === 0 && (
        <>
          <SectionHeading>{w.title}</SectionHeading>
          <Group>
            <div className="px-4 py-3">
              <p className="text-base font-medium">Hali kategoriya yo&apos;q</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{w.empty}</p>
            </div>
          </Group>
        </>
      )}
      {list && list.length > 0 && (
        <OrderedRows
          label={w.title}
          heading={`${list.length} ta kategoriya`}
          items={list}
          getId={(category) => String(category.id)}
          getLabel={(category) => category.name}
          onReorder={(ids) => reorder.mutate(ids.map(Number))}
          canOrder={allowed("settings.edit")}
          row={(category, handle) => {
            const off = !category.is_active && <Badge>Nofaol</Badge>
            const title = <span className={cn(!category.is_active && "text-muted-foreground")}>{category.name}</span>
            return handle ? (
              <Row compact media={handle} title={title} badge={off} />
            ) : (
              <Row compact onClick={acts ? () => setSheet({ act: category }) : undefined} title={title} badge={off} chevron={false} />
            )
          }}
        />
      )}
      <Foot className="-mt-4">{w.foot}</Foot>
      <ActionSheet open={acting !== null} onOpenChange={close} title={acting?.name} items={acting ? actions(acting) : []} />
      {sheet && "add" in sheet && (
        <NameDialog
          title="Kategoriya qo'shish"
          description={`${w.noun} nomi. Tur ichida takrorlanmaydi.`}
          placeholder={w.example}
          submit="Qo'shish"
          done="Kategoriya qo'shildi"
          open
          onOpenChange={close}
          onSubmit={async (name) => {
            await call(api.POST("/app/finance-categories", { body: { name, kind } }))
            await refresh()
          }}
        />
      )}
      {sheet && "rename" in sheet && (
        <NameDialog
          title="Kategoriya nomini o'zgartirish"
          description="Shu kategoriyadagi hujjatlar o'zgarmaydi."
          initial={sheet.rename.name}
          submit="Saqlash"
          done="Kategoriya nomi o'zgartirildi"
          open
          onOpenChange={close}
          onSubmit={async (name) => {
            await call(api.PATCH("/app/finance-categories/{id}", { params: { path: { id: sheet.rename.id } }, body: { name } }))
            await refresh()
          }}
        />
      )}
      {sheet && "remove" in sheet && (
        <DeleteDialog
          title="Kategoriyani o'chirasizmi?"
          description={`«${sheet.remove.name}» kategoriyasi o'chadi. Hujjati bor kategoriya o'chirilmaydi: uni nofaol qilish mumkin.`}
          done="Kategoriya o'chirildi"
          onDelete={async () => {
            await call(api.DELETE("/app/finance-categories/{id}", { params: { path: { id: sheet.remove.id } } }))
            await refresh()
          }}
          open
          onOpenChange={close}
        />
      )}
    </>
  )
}
