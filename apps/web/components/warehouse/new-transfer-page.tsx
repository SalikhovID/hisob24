"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useEffect, useMemo } from "react"
import { toast } from "sonner"
import { PageTitle } from "@/components/kit/page-title"
import { api, call } from "@/lib/api"
import { can } from "@/lib/permissions"
import { transferDefaults, type TransferOutput } from "@/lib/stock"
import { usePermission } from "@/lib/use-gate"
import { useLocation } from "@/lib/use-location"
import { nowLocal } from "@/lib/warehouse"
import { forgetWarehouse } from "./new-purchase-page"
import { NoLocation } from "./no-location"
import { TransferForm } from "./transfer-form"
import { moving } from "@/lib/moves"

const back = { href: "/transfers", label: "Ko'chirishlar" }

// NewTransferPage moves products out of the current location into another
// of the member's, for whoever may add stock documents and may see the
// products (the form finds them by name). With one location there is
// nowhere to move to: back to the transfers. Saved, it opens the
// transfer's page.
export function NewTransferPage() {
  const gate = usePermission("stock.create")
  const companyId = gate?.company.id ?? null
  const withPickers = can(gate?.permissions, "products.view")
  const location = useLocation()
  const locationId = location.current?.id ?? null
  const twoLocations = location.locations.length >= 2
  const router = useRouter()
  const queryClient = useQueryClient()
  const defaults = useMemo(() => transferDefaults(null, nowLocal()), [])
  const create = useMutation({
    mutationFn: (transfer: TransferOutput) => call(api.POST("/app/transfers", { body: { ...transfer, location_id: locationId ?? 0 } })),
    onSuccess: (saved) => {
      if (companyId !== null) forgetWarehouse(queryClient, companyId)
      toast.success("Ko'chirish qo'shildi")
      moving("forward", () => router.push(`/transfers/${saved.id}`))
    },
  })

  // Without a way to the products, or a second location, the form cannot
  // be filled: back to the transfers.
  const noWay = !withPickers || (location.ready && locationId !== null && !twoLocations)
  useEffect(() => {
    if (gate && noWay) router.replace("/transfers")
  }, [gate, noWay, router])

  if (!gate || companyId === null || noWay) return null
  if (location.ready && locationId === null) {
    return (
      <>
        <PageTitle title="Yangi ko'chirish" back={back} />
        <NoLocation />
      </>
    )
  }
  if (locationId === null) return null
  return (
    <>
      <PageTitle title="Yangi ko'chirish" description={location.current?.name} back={back} />
      <TransferForm
        companyId={companyId}
        locationId={locationId}
        defaults={defaults}
        onSubmit={(transfer) => create.mutate(transfer)}
        submitLabel="Saqlash"
        pending={create.isPending || create.isSuccess}
        refusal={create.error?.message}
      />
    </>
  )
}
