"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useEffect, useMemo } from "react"
import { toast } from "sonner"
import { PageHeader } from "@/components/page-header"
import { api, call } from "@/lib/api"
import { can } from "@/lib/permissions"
import { productsKey, purchasesKey, suppliersKey } from "@/lib/queries"
import type { Permission } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { useLocation } from "@/lib/use-location"
import { type PurchaseOutput, purchaseDefaults, today } from "@/lib/warehouse"
import { PurchaseForm } from "./purchase-form"

const back = { href: "/purchases", label: "Xaridlar" }

// forgetWarehouse drops what a purchase changes: the purchases, the
// products' stock and last prices, the suppliers' balances and payments.
export function forgetWarehouse(queryClient: ReturnType<typeof useQueryClient>, companyId: number) {
  queryClient.invalidateQueries({ queryKey: purchasesKey(companyId) })
  queryClient.invalidateQueries({ queryKey: ["purchase", companyId] })
  queryClient.invalidateQueries({ queryKey: productsKey(companyId) })
  queryClient.invalidateQueries({ queryKey: ["product", companyId] })
  queryClient.invalidateQueries({ queryKey: ["product-purchases", companyId] })
  queryClient.invalidateQueries({ queryKey: suppliersKey(companyId) })
  queryClient.invalidateQueries({ queryKey: ["supplier", companyId] })
  queryClient.invalidateQueries({ queryKey: ["payments", companyId] })
}

// NewPurchasePage enters a purchase into the current location, for whoever
// may add purchases and may see the suppliers and the products (the form
// finds them by name; logic/roles.md, 4.3). Saved, it opens the purchase's
// page.
export function NewPurchasePage() {
  const gate = usePermission("purchases.create")
  const companyId = gate?.company.id ?? null
  const allowed = (permission: Permission) => can(gate?.permissions, permission)
  const withPickers = allowed("suppliers.view") && allowed("products.view")
  const location = useLocation()
  const locationId = location.current?.id ?? null
  const router = useRouter()
  const queryClient = useQueryClient()
  const defaults = useMemo(() => purchaseDefaults(null, today()), [])
  const create = useMutation({
    mutationFn: (purchase: PurchaseOutput) => call(api.POST("/app/purchases", { body: { ...purchase, location_id: locationId ?? 0 } })),
    onSuccess: (saved) => {
      if (companyId !== null) forgetWarehouse(queryClient, companyId)
      toast.success("Xarid qo'shildi")
      router.push(`/purchases/${saved.id}`)
    },
  })

  // Without a way to the suppliers and the products the form cannot be
  // filled: back to the purchases.
  useEffect(() => {
    if (gate && !withPickers) router.replace("/purchases")
  }, [gate, withPickers, router])

  if (!gate || companyId === null || !withPickers) return null
  // A member with no location to work in enters nothing (logic/locations.md, section 5).
  if (location.ready && locationId === null) {
    return (
      <div className="space-y-5">
        <PageHeader title="Yangi xarid" back={back} />
        <div className="rounded-xl border bg-card px-4 py-10 text-center text-sm">
          <p className="font-medium">Sizga lokatsiya biriktirilmagan</p>
          <p className="mt-1 text-pretty text-muted-foreground">Kompaniya egasi lokatsiya biriktirishi kerak.</p>
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-5">
      <PageHeader title="Yangi xarid" description={location.current?.name} back={back} />
      <PurchaseForm
        companyId={companyId}
        defaults={defaults}
        onSubmit={(purchase) => create.mutate(purchase)}
        submitLabel="Saqlash"
        pending={create.isPending || create.isSuccess}
        refusal={create.error?.message}
      />
    </div>
  )
}
