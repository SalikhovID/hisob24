"use client"

import { useQueryClient } from "@tanstack/react-query"
import { EyeIcon, EyeOffIcon, PencilIcon, PlusIcon } from "lucide-react"
import { toast } from "sonner"
import { ActionTooltip } from "@/components/action-tooltip"
import { SortableList } from "@/components/sortable-list"
import { EmptyState, Failed, ListLoading } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { api, call } from "@/lib/api"
import { can } from "@/lib/permissions"
import { financeCategoriesKey, useFinanceCategories } from "@/lib/queries"
import type { FinanceCategory, FinanceKind, Permission } from "@/lib/types"
import { inOrder, useReorder } from "@/lib/use-reorder"
import { DeleteButton } from "./delete-button"
import { NameDialog } from "./name-dialog"
import { Section } from "./section"
import { iconAction, SettingRow, settingList } from "./setting-row"

// The words of each kind: what a section is called and what its rows are.
const words: Record<FinanceKind, { title: string; description: string; noun: string; add: string; empty: string }> = {
  expense: {
    title: "Xarajat kategoriyalari",
    description: "Xarajat kiritishda tanlanadi: ijara, kommunal, maosh.",
    noun: "Xarajat kategoriyasi",
    add: "Kategoriya qo'shish",
    empty: "Xarajat kiritish uchun kamida bitta kategoriya kerak.",
  },
  income: {
    title: "Kirim kategoriyalari",
    description: "Sotuvdan tashqari kirimlarda tanlanadi: boshqa kirim, foiz.",
    noun: "Kirim kategoriyasi",
    add: "Kategoriya qo'shish",
    empty: "Kirim kiritish uchun kamida bitta kategoriya kerak.",
  },
}

// FinanceCategories is the settings' tab of the finance categories
// (logic/finance.md, section 6): the expense categories and the income
// categories, each kind in the order the owner put them in.
export function FinanceCategories({ companyId, permissions }: { companyId: number; permissions: Permission[] }) {
  return (
    <>
      <Categories companyId={companyId} permissions={permissions} kind="expense" />
      <Categories companyId={companyId} permissions={permissions} kind="income" />
    </>
  )
}

// Categories is one kind's categories: added, renamed, turned off and on,
// deleted and put in order, each with its permission.
function Categories({ companyId, permissions, kind }: { companyId: number; permissions: Permission[]; kind: FinanceKind }) {
  const allowed = (permission: Permission) => can(permissions, permission)
  const w = words[kind]
  const categories = useFinanceCategories(companyId, kind)
  const queryClient = useQueryClient()
  const queryKey = financeCategoriesKey(companyId, kind)
  // What a change did shows once the list is asked for again.
  const refresh = () => queryClient.invalidateQueries({ queryKey })
  const reorder = useReorder<FinanceCategory[]>(queryKey, inOrder, (ids) => call(api.PUT("/app/finance-categories/order", { body: { kind, ids } })))
  const setActive = async (category: FinanceCategory, active: boolean) => {
    try {
      await call(api.PATCH("/app/finance-categories/{id}", { params: { path: { id: category.id } }, body: { is_active: active } }))
      await refresh()
      toast.success(active ? "Kategoriya faollashtirildi" : "Kategoriya nofaol qilindi")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <Section
      title={w.title}
      description={w.description}
      action={
        allowed("settings.create") && (
          <NameDialog
            title={w.add}
            description={`${w.noun} nomi. Tur ichida takrorlanmaydi.`}
            submit="Qo'shish"
            done="Kategoriya qo'shildi"
            trigger={
              <Button variant="outline" size="lg" className="px-3.5">
                <PlusIcon />
                {w.add}
              </Button>
            }
            onSubmit={async (name) => {
              await call(api.POST("/app/finance-categories", { body: { name, kind } }))
              await refresh()
            }}
          />
        )
      }
    >
      {categories.isPending && <ListLoading rows={2} mark="none" />}
      {categories.isError && <Failed error={categories.error} onRetry={() => categories.refetch()} />}
      {categories.data?.length === 0 && <EmptyState title="Hali kategoriya yo'q" description={w.empty} />}
      {categories.data && categories.data.length > 0 && (
        <SortableList
          label={w.title}
          items={categories.data}
          getId={(category) => String(category.id)}
          getLabel={(category) => category.name}
          onReorder={(ids) => reorder.mutate(ids.map(Number))}
          className={settingList}
          disabled={!allowed("settings.edit")}
          renderItem={(category, handle) => (
            <SettingRow
              handle={handle}
              title={category.name}
              marks={!category.is_active && <Badge variant="secondary">Nofaol</Badge>}
              actions={
                <>
                  {allowed("settings.edit") && (
                    <NameDialog
                      title="Kategoriya nomini o'zgartirish"
                      description="Shu kategoriyadagi hujjatlar o'zgarmaydi."
                      initial={category.name}
                      submit="Saqlash"
                      done="Kategoriya nomi o'zgartirildi"
                      tooltip="Nomini o'zgartirish"
                      trigger={
                        <Button variant="ghost" size="icon" className={iconAction} aria-label={`Nomini o'zgartirish: ${category.name}`}>
                          <PencilIcon />
                        </Button>
                      }
                      onSubmit={async (name) => {
                        await call(api.PATCH("/app/finance-categories/{id}", { params: { path: { id: category.id } }, body: { name } }))
                        await refresh()
                      }}
                    />
                  )}
                  {allowed("settings.edit") && (
                    <ActionTooltip label={category.is_active ? "Nofaol qilish" : "Faollashtirish"}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={iconAction}
                        aria-label={`${category.is_active ? "Nofaol qilish" : "Faollashtirish"}: ${category.name}`}
                        onClick={() => setActive(category, !category.is_active)}
                      >
                        {category.is_active ? <EyeOffIcon /> : <EyeIcon />}
                      </Button>
                    </ActionTooltip>
                  )}
                  {allowed("settings.delete") && (
                    <DeleteButton
                      label={`O'chirish: ${category.name}`}
                      title="Kategoriyani o'chirasizmi?"
                      description={`«${category.name}» kategoriyasi o'chadi. Hujjati bor kategoriya o'chirilmaydi: uni nofaol qilish mumkin.`}
                      done="Kategoriya o'chirildi"
                      onDelete={async () => {
                        await call(api.DELETE("/app/finance-categories/{id}", { params: { path: { id: category.id } } }))
                        await refresh()
                      }}
                    />
                  )}
                </>
              }
            />
          )}
        />
      )}
    </Section>
  )
}
