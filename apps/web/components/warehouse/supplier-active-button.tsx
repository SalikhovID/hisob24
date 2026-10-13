"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Row } from "@/components/kit/group"
import { api, call } from "@/lib/api"
import { supplierKey, suppliersKey } from "@/lib/queries"
import type { Supplier } from "@/lib/types"

// SupplierActiveButton is the accent row at the foot of a supplier's page
// that turns it off (offered to no new purchase; its purchases, balance and
// payments stay; logic/warehouse.md, 3.2) or on again. The page puts it in
// a group, over the row that deletes the supplier.
export function SupplierActiveButton({ companyId, supplier }: { companyId: number; supplier: Supplier }) {
  const queryClient = useQueryClient()
  const toggle = useMutation({
    mutationFn: () =>
      call(api.PATCH("/app/suppliers/{id}", { params: { path: { id: supplier.id } }, body: { is_active: !supplier.is_active } })),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: suppliersKey(companyId) })
      queryClient.setQueryData(supplierKey(companyId, supplier.id), saved)
      toast.success(saved.is_active ? "Ta'minotchi faollashtirildi" : "Ta'minotchi nofaol qilindi")
    },
    onError: (error) => toast.error(error.message),
  })

  return (
    <Row
      variant="accent"
      title={supplier.is_active ? "Nofaol qilish" : "Faollashtirish"}
      disabled={toggle.isPending}
      onClick={() => toggle.mutate()}
    />
  )
}
