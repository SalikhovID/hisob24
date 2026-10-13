"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useEffect, useMemo } from "react"
import { toast } from "sonner"
import { PageTitle } from "@/components/kit/page-title"
import { api, call } from "@/lib/api"
import { can } from "@/lib/permissions"
import { inventoryDefaults, type InventoryOutput } from "@/lib/stock"
import { usePermission } from "@/lib/use-gate"
import { useLocation } from "@/lib/use-location"
import { nowLocal } from "@/lib/warehouse"
import { InventoryForm } from "./inventory-form"
import { forgetWarehouse } from "./new-purchase-page"
import { NoLocation } from "./no-location"
import { stepForward } from "@/lib/moves"

const back = { href: "/inventories", label: "Inventarizatsiya" }

// NewInventoryPage enters a count of the current location, for whoever may
// add stock documents and may see the products. Saved, it opens the
// inventory's page.
export function NewInventoryPage() {
  const gate = usePermission("stock.create")
  const companyId = gate?.company.id ?? null
  const withPickers = can(gate?.permissions, "products.view")
  const location = useLocation()
  const locationId = location.current?.id ?? null
  const router = useRouter()
  const queryClient = useQueryClient()
  const defaults = useMemo(() => inventoryDefaults(null, nowLocal()), [])
  const create = useMutation({
    mutationFn: (inventory: InventoryOutput) => call(api.POST("/app/inventories", { body: { ...inventory, location_id: locationId ?? 0 } })),
    onSuccess: (saved) => {
      if (companyId !== null) forgetWarehouse(queryClient, companyId)
      toast.success("Inventarizatsiya qo'shildi")
      router.push(`/inventories/${saved.id}`, { transitionTypes: stepForward })
    },
  })

  useEffect(() => {
    if (gate && !withPickers) router.replace("/inventories")
  }, [gate, withPickers, router])

  if (!gate || companyId === null || !withPickers) return null
  if (location.ready && locationId === null) {
    return (
      <>
        <PageTitle title="Yangi inventarizatsiya" back={back} />
        <NoLocation />
      </>
    )
  }
  if (locationId === null) return null
  return (
    <>
      <PageTitle title="Yangi inventarizatsiya" description={location.current?.name} back={back} />
      <InventoryForm
        companyId={companyId}
        locationId={locationId}
        defaults={defaults}
        onSubmit={(inventory) => create.mutate(inventory)}
        submitLabel="Saqlash"
        pending={create.isPending || create.isSuccess}
        refusal={create.error?.message}
      />
    </>
  )
}
