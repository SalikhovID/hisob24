"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useEffect, useMemo } from "react"
import { toast } from "sonner"
import { PageTitle } from "@/components/kit/page-title"
import { api, call } from "@/lib/api"
import { can } from "@/lib/permissions"
import { openingStockDefaults, type OpeningStockOutput } from "@/lib/stock"
import { usePermission } from "@/lib/use-gate"
import { useLocation } from "@/lib/use-location"
import { nowLocal } from "@/lib/warehouse"
import { forgetWarehouse } from "./new-purchase-page"
import { NoLocation } from "./no-location"
import { OpeningStockForm } from "./opening-stock-form"
import { moving } from "@/lib/moves"

const back = { href: "/opening-stock", label: "Boshlang'ich qoldiq" }

// NewOpeningStockPage enters the stock the current location starts with,
// for whoever may add stock documents and may see the products. Saved, it
// opens the document's page.
export function NewOpeningStockPage() {
  const gate = usePermission("stock.create")
  const companyId = gate?.company.id ?? null
  const withPickers = can(gate?.permissions, "products.view")
  const location = useLocation()
  const locationId = location.current?.id ?? null
  const router = useRouter()
  const queryClient = useQueryClient()
  const defaults = useMemo(() => openingStockDefaults(null, nowLocal()), [])
  const create = useMutation({
    mutationFn: (opening: OpeningStockOutput) => call(api.POST("/app/opening-stock", { body: { ...opening, location_id: locationId ?? 0 } })),
    onSuccess: (saved) => {
      if (companyId !== null) forgetWarehouse(queryClient, companyId)
      toast.success("Boshlang'ich qoldiq qo'shildi")
      moving("forward", () => router.push(`/opening-stock/${saved.id}`))
    },
  })

  useEffect(() => {
    if (gate && !withPickers) router.replace("/opening-stock")
  }, [gate, withPickers, router])

  if (!gate || companyId === null || !withPickers) return null
  if (location.ready && locationId === null) {
    return (
      <>
        <PageTitle title="Yangi boshlang'ich qoldiq" back={back} />
        <NoLocation />
      </>
    )
  }
  return (
    <>
      <PageTitle title="Yangi boshlang'ich qoldiq" description={location.current?.name} back={back} />
      <OpeningStockForm
        companyId={companyId}
        defaults={defaults}
        onSubmit={(opening) => create.mutate(opening)}
        submitLabel="Saqlash"
        pending={create.isPending || create.isSuccess}
        refusal={create.error?.message}
      />
    </>
  )
}
