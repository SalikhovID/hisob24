"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { toast } from "sonner"
import { BackLink, PageTitle } from "@/components/kit/page-title"
import { Failed, ListLoading, NotFound } from "@/components/states"
import { forgetWarehouse } from "@/components/warehouse/new-purchase-page"
import { api, ApiError, call } from "@/lib/api"
import { can } from "@/lib/permissions"
import { useSale } from "@/lib/queries"
import { saleDefaults, type SaleOutput } from "@/lib/sales"
import { usePermission } from "@/lib/use-gate"
import { nowLocal } from "@/lib/warehouse"
import { SaleForm } from "./sale-form"
import { stepBack } from "@/lib/moves"

const back = { href: "/sales", label: "Sotuvlar" }

// EditSalePage saves a sale with other fields, lines and payments, for
// whoever may edit sales and may see the products; its number and location
// stay. Saved, it opens the sale's page.
export function EditSalePage({ id }: { id: number }) {
  const gate = usePermission("sales.edit")
  const companyId = gate?.company.id ?? null
  const withPickers = can(gate?.permissions, "products.view")
  const withCustomers = can(gate?.permissions, "customers.view")
  const sale = useSale(companyId, id)
  const router = useRouter()
  const queryClient = useQueryClient()
  const save = useMutation({
    mutationFn: (fields: SaleOutput) => call(api.PUT("/app/sales/{id}", { params: { path: { id } }, body: fields })),
    onSuccess: () => {
      if (companyId !== null) forgetWarehouse(queryClient, companyId)
      toast.success("Sotuv saqlandi")
      router.push(`/sales/${id}`, { transitionTypes: stepBack })
    },
  })

  useEffect(() => {
    if (gate && !withPickers) router.replace(`/sales/${id}`)
  }, [gate, withPickers, router, id])

  if (!gate || companyId === null || !withPickers) return null
  if (sale.error instanceof ApiError && sale.error.status === 404) {
    return (
      <>
        <BackLink {...back} />
        <NotFound title="Sotuv topilmadi" description="Bu sotuv o'chirilgan yoki siz ishlamaydigan lokatsiyada." />
      </>
    )
  }
  if (!sale.data) {
    return (
      <>
        <PageTitle title="Sotuvni tahrirlash" back={back} />
        {sale.isError ? <Failed error={sale.error} onRetry={() => sale.refetch()} /> : <ListLoading rows={4} mark="none" />}
      </>
    )
  }
  const s = sale.data
  return (
    <>
      <PageTitle title="Sotuvni tahrirlash" description={`№ ${s.number} · ${s.location_name}`} back={{ href: `/sales/${s.id}`, label: `Sotuv № ${s.number}` }} />
      <SaleForm
        key={s.updated_at}
        companyId={companyId}
        withCustomers={withCustomers}
        defaults={saleDefaults(s, nowLocal())}
        onSubmit={(fields) => save.mutate(fields)}
        submitLabel="Saqlash"
        pending={save.isPending || save.isSuccess}
        refusal={save.error?.message}
        locationName={s.location_name}
      />
    </>
  )
}
