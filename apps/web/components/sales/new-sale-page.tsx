"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useEffect, useMemo } from "react"
import { toast } from "sonner"
import { PageTitle } from "@/components/kit/page-title"
import { forgetWarehouse } from "@/components/warehouse/new-purchase-page"
import { NoLocation } from "@/components/warehouse/no-location"
import { api, call } from "@/lib/api"
import { can } from "@/lib/permissions"
import { saleDefaults, type SaleOutput } from "@/lib/sales"
import { usePermission } from "@/lib/use-gate"
import { useLocation } from "@/lib/use-location"
import { nowLocal } from "@/lib/warehouse"
import { SaleForm } from "./sale-form"
import { moving } from "@/lib/moves"

const back = { href: "/sales", label: "Sotuvlar" }

// NewSalePage enters a sale out of the current location, for whoever may
// add sales and may see the products (the form finds them by name); the
// customers are offered to whoever may see them, the sale being retail
// otherwise. Saved, it opens the sale's page.
export function NewSalePage() {
  const gate = usePermission("sales.create")
  const companyId = gate?.company.id ?? null
  const withPickers = can(gate?.permissions, "products.view")
  const withCustomers = can(gate?.permissions, "customers.view")
  const location = useLocation()
  const locationId = location.current?.id ?? null
  const router = useRouter()
  const queryClient = useQueryClient()
  const defaults = useMemo(() => saleDefaults(null, nowLocal()), [])
  const create = useMutation({
    mutationFn: (sale: SaleOutput) => call(api.POST("/app/sales", { body: { ...sale, location_id: locationId ?? 0 } })),
    onSuccess: (saved) => {
      if (companyId !== null) forgetWarehouse(queryClient, companyId)
      toast.success("Sotuv qo'shildi")
      moving("forward", () => router.push(`/sales/${saved.id}`))
    },
  })

  useEffect(() => {
    if (gate && !withPickers) router.replace("/sales")
  }, [gate, withPickers, router])

  if (!gate || companyId === null || !withPickers) return null
  if (location.ready && locationId === null) {
    return (
      <>
        <PageTitle title="Yangi sotuv" back={back} />
        <NoLocation />
      </>
    )
  }
  return (
    <>
      <PageTitle title="Yangi sotuv" description={location.current?.name} back={back} />
      <SaleForm
        companyId={companyId}
        withCustomers={withCustomers}
        defaults={defaults}
        onSubmit={(sale) => create.mutate(sale)}
        submitLabel="Saqlash"
        pending={create.isPending || create.isSuccess}
        refusal={create.error?.message}
        locationName={location.current?.name}
      />
    </>
  )
}
