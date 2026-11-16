"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { ActionSheet } from "@/components/kit/action-sheet"
import { Foot, Group, Row, SectionHeading } from "@/components/kit/group"
import { OrderedRows } from "@/components/kit/ordered-rows"
import { PageTitle, PlusButton } from "@/components/kit/page-title"
import { Failed, ListLoading } from "@/components/states"
import { api, call } from "@/lib/api"
import { can } from "@/lib/permissions"
import { productCategoriesKey, useProductCategories } from "@/lib/queries"
import type { Permission, ProductCategory } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { inOrder, useReorder } from "@/lib/use-reorder"
import { DeleteDialog } from "./delete-button"
import { NameDialog } from "./name-dialog"

// Sheet is what is open over the page: a category being added, its
// actions, a category being renamed or deleted.
type Sheet = { add: true } | { act: ProductCategory } | { rename: ProductCategory } | { remove: ProductCategory }

// ProductCategoriesPage is the categories of the company's products
// (logic/products.md, 3.4), for whoever may see the settings, as the
// finance categories' page: the categories in the order the owner put
// them in, each a row opening a sheet of its actions (renaming:
// settings.edit; deleting: settings.delete, one with products refused, the
// refusal saying how many); the plus adds one at the end (settings.create);
// the «Tartiblash» mode orders them (settings.edit).
export function ProductCategoriesPage() {
  const gate = usePermission("settings.view")
  const companyId = gate?.company.id ?? null
  const allowed = (permission: Permission) => can(gate?.permissions, permission)
  const categories = useProductCategories(companyId)
  const queryClient = useQueryClient()
  const queryKey = productCategoriesKey(companyId)
  // What a change did shows once the list is asked for again.
  const refresh = () => queryClient.invalidateQueries({ queryKey })
  const reorder = useReorder<ProductCategory[]>(queryKey, inOrder, (ids) => call(api.PUT("/app/product-categories/order", { body: { ids } })))
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const close = (open: boolean) => !open && setSheet(null)
  const actions = (category: ProductCategory) => [
    ...(allowed("settings.edit") ? [{ label: "Nomini o'zgartirish", onSelect: () => setSheet({ rename: category }) }] : []),
    ...(allowed("settings.delete") ? [{ label: "O'chirish", danger: true, onSelect: () => setSheet({ remove: category }) }] : []),
  ]
  const acts = allowed("settings.edit") || allowed("settings.delete")

  if (!gate || companyId === null) return null
  const acting = sheet && "act" in sheet ? sheet.act : null
  const list = categories.data
  return (
    <>
      <PageTitle
        title="Mahsulot kategoriyalari"
        description="Mahsulotlar kategoriya bo'yicha guruhlanadi."
        back={{ href: "/settings", label: "Sozlamalar" }}
        action={allowed("settings.create") && <PlusButton label="Kategoriya qo'shish" onClick={() => setSheet({ add: true })} />}
      />
      {categories.isPending && <ListLoading rows={2} mark="none" />}
      {categories.isError && <Failed error={categories.error} onRetry={() => categories.refetch()} />}
      {list?.length === 0 && (
        <>
          <SectionHeading>Kategoriyalar</SectionHeading>
          <Group>
            <div className="px-4 py-3">
              <p className="text-base font-medium">Hali kategoriya yo&apos;q</p>
              <p className="mt-0.5 text-sm text-muted-foreground">Mahsulotlarni guruhlash uchun kategoriya qo&apos;shing.</p>
            </div>
          </Group>
        </>
      )}
      {list && list.length > 0 && (
        <OrderedRows
          label="Kategoriyalar"
          heading={`${list.length} ta kategoriya`}
          items={list}
          getId={(category) => String(category.id)}
          getLabel={(category) => category.name}
          onReorder={(ids) => reorder.mutate(ids.map(Number))}
          canOrder={allowed("settings.edit")}
          row={(category, handle) =>
            handle ? (
              <Row compact media={handle} title={<span>{category.name}</span>} />
            ) : (
              <Row compact onClick={acts ? () => setSheet({ act: category }) : undefined} title={<span>{category.name}</span>} chevron={false} />
            )
          }
        />
      )}
      <Foot className="-mt-4">Mahsulot qo&apos;shishda tanlanadi: ichimliklar, shirinliklar, xo&apos;jalik.</Foot>
      <ActionSheet open={acting !== null} onOpenChange={close} title={acting?.name} items={acting ? actions(acting) : []} />
      {sheet && "add" in sheet && (
        <NameDialog
          title="Kategoriya qo'shish"
          description="Mahsulot kategoriyasi nomi. Kompaniyada takrorlanmaydi."
          placeholder="Masalan, Ichimliklar"
          submit="Qo'shish"
          done="Kategoriya qo'shildi"
          open
          onOpenChange={close}
          onSubmit={async (name) => {
            await call(api.POST("/app/product-categories", { body: { name } }))
            await refresh()
          }}
        />
      )}
      {sheet && "rename" in sheet && (
        <NameDialog
          title="Kategoriya nomini o'zgartirish"
          description="Mahsulotlar kategoriyani yangi nomi bilan ko'rsatadi."
          initial={sheet.rename.name}
          submit="Saqlash"
          done="Kategoriya nomi o'zgartirildi"
          open
          onOpenChange={close}
          onSubmit={async (name) => {
            await call(api.PATCH("/app/product-categories/{id}", { params: { path: { id: sheet.rename.id } }, body: { name } }))
            await refresh()
          }}
        />
      )}
      {sheet && "remove" in sheet && (
        <DeleteDialog
          title="Kategoriyani o'chirasizmi?"
          description={`«${sheet.remove.name}» kategoriyasi o'chadi. Mahsuloti bor kategoriya o'chirilmaydi: avval mahsulotlarni boshqa kategoriyaga o'tkazing.`}
          done="Kategoriya o'chirildi"
          onDelete={async () => {
            await call(api.DELETE("/app/product-categories/{id}", { params: { path: { id: sheet.remove.id } } }))
            await refresh()
          }}
          open
          onOpenChange={close}
        />
      )}
    </>
  )
}
