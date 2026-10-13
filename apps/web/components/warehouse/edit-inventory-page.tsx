"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { toast } from "sonner"
import { BackLink, PageTitle } from "@/components/kit/page-title"
import { Failed, ListLoading, NotFound } from "@/components/states"
import { api, ApiError, call } from "@/lib/api"
import { can } from "@/lib/permissions"
import { useInventory } from "@/lib/queries"
import { inventoryDefaults, type InventoryOutput } from "@/lib/stock"
import { usePermission } from "@/lib/use-gate"
import { nowLocal } from "@/lib/warehouse"
import { InventoryForm } from "./inventory-form"
import { forgetWarehouse } from "./new-purchase-page"
import { stepBack } from "@/lib/moves"

const back = { href: "/inventories", label: "Inventarizatsiya" }

// EditInventoryPage saves a count with another moment, lines and note, for
// whoever may edit stock documents and may see the products; its number
// and location stay, and what the journal expected is counted anew. Saved,
// it opens the inventory's page.
export function EditInventoryPage({ id }: { id: number }) {
  const gate = usePermission("stock.edit")
  const companyId = gate?.company.id ?? null
  const withPickers = can(gate?.permissions, "products.view")
  const inventory = useInventory(companyId, id)
  const router = useRouter()
  const queryClient = useQueryClient()
  const save = useMutation({
    mutationFn: (fields: InventoryOutput) => call(api.PUT("/app/inventories/{id}", { params: { path: { id } }, body: fields })),
    onSuccess: () => {
      if (companyId !== null) forgetWarehouse(queryClient, companyId)
      toast.success("Inventarizatsiya saqlandi")
      router.push(`/inventories/${id}`, { transitionTypes: stepBack })
    },
  })

  useEffect(() => {
    if (gate && !withPickers) router.replace(`/inventories/${id}`)
  }, [gate, withPickers, router, id])

  if (!gate || companyId === null || !withPickers) return null
  if (inventory.error instanceof ApiError && inventory.error.status === 404) {
    return (
      <>
        <BackLink {...back} />
        <NotFound title="Inventarizatsiya topilmadi" description="Bu inventarizatsiya o'chirilgan yoki siz ishlamaydigan lokatsiyada." />
      </>
    )
  }
  if (!inventory.data) {
    return (
      <>
        <PageTitle title="Inventarizatsiyani tahrirlash" back={back} />
        {inventory.isError ? <Failed error={inventory.error} onRetry={() => inventory.refetch()} /> : <ListLoading rows={4} mark="none" />}
      </>
    )
  }
  const i = inventory.data
  return (
    <>
      <PageTitle
        title="Inventarizatsiyani tahrirlash"
        description={`№ ${i.number} · ${i.location_name}`}
        back={{ href: `/inventories/${i.id}`, label: `Inventarizatsiya № ${i.number}` }}
      />
      <InventoryForm
        key={i.updated_at}
        companyId={companyId}
        locationId={i.location_id}
        excludeId={i.id}
        defaults={inventoryDefaults(i, nowLocal())}
        onSubmit={(fields) => save.mutate(fields)}
        submitLabel="Saqlash"
        pending={save.isPending || save.isSuccess}
        refusal={save.error?.message}
      />
    </>
  )
}
