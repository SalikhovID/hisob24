"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { MapPinIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo } from "react"
import { toast } from "sonner"
import { PageTitle } from "@/components/kit/page-title"
import { EmptyState } from "@/components/states"
import { api, call } from "@/lib/api"
import { can } from "@/lib/permissions"
import type { Permission } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { useLocation } from "@/lib/use-location"
import { type PurchaseOutput, nowLocal, purchaseDefaults } from "@/lib/warehouse"
import { forgetFinance } from "@/lib/finance"
import { PurchaseForm } from "./purchase-form"

const back = { href: "/purchases", label: "Xaridlar" }

// forgetWarehouse drops what a stock document changes: the documents of
// every kind, the products' stock, last prices and moves, the stock at a
// moment, the suppliers' and the customers' balances, payments and statements.
export function forgetWarehouse(queryClient: ReturnType<typeof useQueryClient>, companyId: number) {
  // The payments entered with a document move money in the accounts too.
  forgetFinance(queryClient, companyId)
  for (const key of [
    "purchases",
    "purchase",
    "transfers",
    "transfer",
    "inventories",
    "inventory",
    "opening-stock",
    "opening-stock-item",
    "stock-at",
    "products",
    "product",
    "product-purchases",
    "product-moves",
    "suppliers",
    "supplier",
    "payments",
    "statement",
    "sales",
    "sale",
    "customers",
    "customer",
    "customer-statement",
  ]) {
    queryClient.invalidateQueries({ queryKey: [key, companyId] })
  }
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
  const defaults = useMemo(() => purchaseDefaults(null, nowLocal()), [])
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
      <>
        <PageTitle title="Yangi xarid" back={back} />
        <EmptyState icon={MapPinIcon} title="Sizga lokatsiya biriktirilmagan" description="Kompaniya egasi lokatsiya biriktirishi kerak." />
      </>
    )
  }
  return (
    <>
      <PageTitle title="Yangi xarid" description={location.current?.name} back={back} />
      <PurchaseForm
        companyId={companyId}
        defaults={defaults}
        onSubmit={(purchase) => create.mutate(purchase)}
        submitLabel="Saqlash"
        pending={create.isPending || create.isSuccess}
        refusal={create.error?.message}
        locationName={location.current?.name}
      />
    </>
  )
}
