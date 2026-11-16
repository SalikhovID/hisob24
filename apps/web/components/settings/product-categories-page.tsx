"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Foot, Group, Row, SectionHeading } from "@/components/kit/group"
import { OrderedRows } from "@/components/kit/ordered-rows"
import { PageTitle, PlusButton } from "@/components/kit/page-title"
import { Failed, ListLoading } from "@/components/states"
import { api, call } from "@/lib/api"
import { productCategoriesKey, useProductCategories } from "@/lib/queries"
import { usePermission } from "@/lib/use-gate"
import { NameDialog } from "./name-dialog"

// ProductCategoriesPage is the categories of the company's products
// (logic/products.md, 3.4), for whoever may see the settings, as the
// finance categories' page: the categories in the order the owner put
// them in, each a row; the plus adds one at the end.
export function ProductCategoriesPage() {
  const gate = usePermission("settings.view")
  const companyId = gate?.company.id ?? null
  const categories = useProductCategories(companyId)
  const queryClient = useQueryClient()
  // What a change did shows once the list is asked for again.
  const refresh = () => queryClient.invalidateQueries({ queryKey: productCategoriesKey(companyId) })
  const [adding, setAdding] = useState(false)

  if (!gate || companyId === null) return null
  const list = categories.data
  return (
    <>
      <PageTitle
        title="Mahsulot kategoriyalari"
        description="Mahsulotlar kategoriya bo'yicha guruhlanadi."
        back={{ href: "/settings", label: "Sozlamalar" }}
        action={<PlusButton label="Kategoriya qo'shish" onClick={() => setAdding(true)} />}
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
          onReorder={() => undefined}
          canOrder={false}
          row={(category) => <Row compact title={<span>{category.name}</span>} chevron={false} />}
        />
      )}
      <Foot className="-mt-4">Mahsulot qo&apos;shishda tanlanadi: ichimliklar, shirinliklar, xo&apos;jalik.</Foot>
      {adding && (
        <NameDialog
          title="Kategoriya qo'shish"
          description="Mahsulot kategoriyasi nomi. Kompaniyada takrorlanmaydi."
          placeholder="Masalan, Ichimliklar"
          submit="Qo'shish"
          done="Kategoriya qo'shildi"
          open
          onOpenChange={(open) => !open && setAdding(false)}
          onSubmit={async (name) => {
            await call(api.POST("/app/product-categories", { body: { name } }))
            await refresh()
          }}
        />
      )}
    </>
  )
}
