"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { toast } from "sonner"
import { BackLink, PageTitle } from "@/components/kit/page-title"
import { Failed, ListLoading, NotFound } from "@/components/states"
import { api, ApiError, call } from "@/lib/api"
import { can } from "@/lib/permissions"
import { usePurchase } from "@/lib/queries"
import type { Permission } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { type PurchaseOutput, nowLocal, purchaseDefaults } from "@/lib/warehouse"
import { forgetWarehouse } from "./new-purchase-page"
import { PurchaseForm } from "./purchase-form"
import { stepBack } from "@/lib/moves"

const back = { href: "/purchases", label: "Xaridlar" }

// EditPurchasePage saves a purchase with other fields and lines, for whoever
// may edit purchases and may see the suppliers and the products; its number
// and location stay. Saved, it opens the purchase's page.
export function EditPurchasePage({ id }: { id: number }) {
  const gate = usePermission("purchases.edit")
  const companyId = gate?.company.id ?? null
  const allowed = (permission: Permission) => can(gate?.permissions, permission)
  const withPickers = allowed("suppliers.view") && allowed("products.view")
  const purchase = usePurchase(companyId, id)
  const router = useRouter()
  const queryClient = useQueryClient()
  const save = useMutation({
    mutationFn: (fields: PurchaseOutput) => call(api.PUT("/app/purchases/{id}", { params: { path: { id } }, body: fields })),
    onSuccess: () => {
      if (companyId !== null) forgetWarehouse(queryClient, companyId)
      toast.success("Xarid saqlandi")
      router.push(`/purchases/${id}`, { transitionTypes: stepBack })
    },
  })

  useEffect(() => {
    if (gate && !withPickers) router.replace(`/purchases/${id}`)
  }, [gate, withPickers, router, id])

  if (!gate || companyId === null || !withPickers) return null
  if (purchase.error instanceof ApiError && purchase.error.status === 404) {
    return (
      <>
        <BackLink {...back} />
        <NotFound title="Xarid topilmadi" description="Bu xarid o'chirilgan yoki siz ishlamaydigan lokatsiyada." />
      </>
    )
  }
  if (!purchase.data) {
    return (
      <>
        <PageTitle title="Xaridni tahrirlash" back={back} />
        {purchase.isError ? <Failed error={purchase.error} onRetry={() => purchase.refetch()} /> : <ListLoading rows={4} mark="none" />}
      </>
    )
  }
  const p = purchase.data
  return (
    <>
      <PageTitle title="Xaridni tahrirlash" description={`№ ${p.number} · ${p.location_name}`} back={{ href: `/purchases/${p.id}`, label: `Xarid № ${p.number}` }} />
      <PurchaseForm
        key={p.updated_at}
        companyId={companyId}
        defaults={purchaseDefaults(p, nowLocal())}
        onSubmit={(fields) => save.mutate(fields)}
        submitLabel="Saqlash"
        pending={save.isPending || save.isSuccess}
        refusal={save.error?.message}
        locationName={p.location_name}
      />
    </>
  )
}
