"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { toast } from "sonner"
import { PageHeader } from "@/components/page-header"
import { Failed, ListLoading } from "@/components/states"
import { api, ApiError, call } from "@/lib/api"
import { can } from "@/lib/permissions"
import { useOpeningStock } from "@/lib/queries"
import { openingStockDefaults, type OpeningStockOutput } from "@/lib/stock"
import { usePermission } from "@/lib/use-gate"
import { nowLocal } from "@/lib/warehouse"
import { forgetWarehouse } from "./new-purchase-page"
import { OpeningStockForm } from "./opening-stock-form"

const back = { href: "/opening-stock", label: "Boshlang'ich qoldiq" }

// EditOpeningStockPage saves an opening stock with other fields and lines,
// for whoever may edit stock documents and may see the products; its
// number and location stay. Saved, it opens the document's page.
export function EditOpeningStockPage({ id }: { id: number }) {
  const gate = usePermission("stock.edit")
  const companyId = gate?.company.id ?? null
  const withPickers = can(gate?.permissions, "products.view")
  const opening = useOpeningStock(companyId, id)
  const router = useRouter()
  const queryClient = useQueryClient()
  const save = useMutation({
    mutationFn: (fields: OpeningStockOutput) => call(api.PUT("/app/opening-stock/{id}", { params: { path: { id } }, body: fields })),
    onSuccess: () => {
      if (companyId !== null) forgetWarehouse(queryClient, companyId)
      toast.success("Boshlang'ich qoldiq saqlandi")
      router.push(`/opening-stock/${id}`)
    },
  })

  useEffect(() => {
    if (gate && !withPickers) router.replace(`/opening-stock/${id}`)
  }, [gate, withPickers, router, id])

  if (!gate || companyId === null || !withPickers) return null
  if (opening.error instanceof ApiError && opening.error.status === 404) {
    return <PageHeader title="Hujjat topilmadi" description="Bu hujjat o'chirilgan yoki siz ishlamaydigan lokatsiyada." back={back} />
  }
  if (!opening.data) {
    return (
      <div className="space-y-5">
        <PageHeader title="Boshlang'ich qoldiqni tahrirlash" back={back} />
        {opening.isError ? <Failed error={opening.error} onRetry={() => opening.refetch()} /> : <ListLoading rows={4} mark="none" />}
      </div>
    )
  }
  const o = opening.data
  return (
    <div className="space-y-5">
      <PageHeader
        title="Boshlang'ich qoldiqni tahrirlash"
        description={`№ ${o.number} · ${o.location_name}`}
        back={{ href: `/opening-stock/${o.id}`, label: `Boshlang'ich qoldiq № ${o.number}` }}
      />
      <OpeningStockForm
        key={o.updated_at}
        companyId={companyId}
        defaults={openingStockDefaults(o, nowLocal())}
        onSubmit={(fields) => save.mutate(fields)}
        submitLabel="Saqlash"
        pending={save.isPending || save.isSuccess}
        refusal={save.error?.message}
      />
    </div>
  )
}
