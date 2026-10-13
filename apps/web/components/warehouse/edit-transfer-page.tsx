"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { toast } from "sonner"
import { BackLink, PageTitle } from "@/components/kit/page-title"
import { Failed, ListLoading, NotFound } from "@/components/states"
import { api, ApiError, call } from "@/lib/api"
import { can } from "@/lib/permissions"
import { useTransfer } from "@/lib/queries"
import { transferDefaults, type TransferOutput } from "@/lib/stock"
import { usePermission } from "@/lib/use-gate"
import { nowLocal } from "@/lib/warehouse"
import { forgetWarehouse } from "./new-purchase-page"
import { TransferForm } from "./transfer-form"
import { moving } from "@/lib/moves"

const back = { href: "/transfers", label: "Ko'chirishlar" }

// EditTransferPage saves a transfer with another destination, moment, lines
// and note, for whoever may edit stock documents and may see the products;
// its number and source stay. Saved, it opens the transfer's page.
export function EditTransferPage({ id }: { id: number }) {
  const gate = usePermission("stock.edit")
  const companyId = gate?.company.id ?? null
  const withPickers = can(gate?.permissions, "products.view")
  const transfer = useTransfer(companyId, id)
  const router = useRouter()
  const queryClient = useQueryClient()
  const save = useMutation({
    mutationFn: (fields: TransferOutput) => call(api.PUT("/app/transfers/{id}", { params: { path: { id } }, body: fields })),
    onSuccess: () => {
      if (companyId !== null) forgetWarehouse(queryClient, companyId)
      toast.success("Ko'chirish saqlandi")
      moving("back", () => router.push(`/transfers/${id}`))
    },
  })

  useEffect(() => {
    if (gate && !withPickers) router.replace(`/transfers/${id}`)
  }, [gate, withPickers, router, id])

  if (!gate || companyId === null || !withPickers) return null
  if (transfer.error instanceof ApiError && transfer.error.status === 404) {
    return (
      <>
        <BackLink {...back} />
        <NotFound title="Ko'chirish topilmadi" description="Bu ko'chirish o'chirilgan yoki siz ishlamaydigan lokatsiyalar orasida." />
      </>
    )
  }
  if (!transfer.data) {
    return (
      <>
        <PageTitle title="Ko'chirishni tahrirlash" back={back} />
        {transfer.isError ? <Failed error={transfer.error} onRetry={() => transfer.refetch()} /> : <ListLoading rows={4} mark="none" />}
      </>
    )
  }
  const t = transfer.data
  return (
    <>
      <PageTitle title="Ko'chirishni tahrirlash" description={`№ ${t.number} · ${t.location_name}`} back={{ href: `/transfers/${t.id}`, label: `Ko'chirish № ${t.number}` }} />
      <TransferForm
        key={t.updated_at}
        companyId={companyId}
        locationId={t.location_id}
        defaults={transferDefaults(t, nowLocal())}
        onSubmit={(fields) => save.mutate(fields)}
        submitLabel="Saqlash"
        pending={save.isPending || save.isSuccess}
        refusal={save.error?.message}
      />
    </>
  )
}
