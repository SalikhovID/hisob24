"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { MapPinIcon } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo } from "react"
import { toast } from "sonner"
import { PageTitle } from "@/components/kit/page-title"
import { EmptyState } from "@/components/states"
import { api, call } from "@/lib/api"
import { UZS } from "@/lib/currencies"
import { can } from "@/lib/permissions"
import { useProduct, useSupplier } from "@/lib/queries"
import type { Permission } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { useLocation } from "@/lib/use-location"
import { emptyLine, nowLocal, type PurchaseOutput, purchaseDefaults } from "@/lib/warehouse"
import { forgetFinance } from "@/lib/finance"
import { PurchaseForm } from "./purchase-form"
import { moving } from "@/lib/moves"

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
// finds them by name; logic/roles.md, 4.3). Opened from a supplier's or a
// product's «Xarid» tile (?supplier=, ?product=) it starts with that one
// chosen: the product in the first line at its last price, when that is in
// so'm. Saved, it opens the purchase's page.
export function NewPurchasePage() {
  const gate = usePermission("purchases.create")
  const companyId = gate?.company.id ?? null
  const allowed = (permission: Permission) => can(gate?.permissions, permission)
  const withPickers = allowed("suppliers.view") && allowed("products.view")
  const location = useLocation()
  const locationId = location.current?.id ?? null
  const router = useRouter()
  const queryClient = useQueryClient()
  const params = useSearchParams()
  const supplierId = Number(params.get("supplier")) || 0
  const productId = Number(params.get("product")) || 0
  const supplier = useSupplier(supplierId ? companyId : null, supplierId)
  const product = useProduct(productId ? companyId : null, productId)
  // The form starts once what it starts with is known (or is not to be had).
  const ready = (!supplierId || !supplier.isPending) && (!productId || !product.isPending)
  const defaults = useMemo(() => {
    const empty = purchaseDefaults(null, nowLocal())
    if (!ready) return empty
    const s = supplier.data
    const p = product.data?.kind === "product" ? product.data : undefined
    const price = p?.last_price && p.last_price.currency_id === UZS ? p.last_price.amount : ""
    return {
      ...empty,
      ...(s && { supplier_id: s.id, supplier_name: s.name }),
      ...(p && { items: [{ ...emptyLine(), product_id: p.id, product_name: p.name, unit: p.unit, price }] }),
    }
  }, [ready, supplier.data, product.data])
  const create = useMutation({
    mutationFn: (purchase: PurchaseOutput) => call(api.POST("/app/purchases", { body: { ...purchase, location_id: locationId ?? 0 } })),
    onSuccess: (saved) => {
      if (companyId !== null) forgetWarehouse(queryClient, companyId)
      toast.success("Xarid qo'shildi")
      moving("forward", () => router.push(`/purchases/${saved.id}`))
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
  if (!ready) return <PageTitle title="Yangi xarid" description={location.current?.name} back={back} />
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
