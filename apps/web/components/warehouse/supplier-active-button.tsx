"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { EyeIcon, EyeOffIcon } from "lucide-react"
import { toast } from "sonner"
import { ActionTooltip } from "@/components/action-tooltip"
import { iconAction } from "@/components/catalog/icon-action"
import { PendingButton } from "@/components/pending-button"
import { Button } from "@/components/ui/button"
import { api, call } from "@/lib/api"
import { supplierKey, suppliersKey } from "@/lib/queries"
import type { Supplier } from "@/lib/types"

// SupplierActiveButton turns a supplier off (offered to no new purchase;
// its purchases, balance and payments stay; logic/warehouse.md, 3.2) or on
// again: on a page as a full button, in a row as an icon.
export function SupplierActiveButton({ companyId, supplier, iconOnly = false }: { companyId: number; supplier: Supplier; iconOnly?: boolean }) {
  const queryClient = useQueryClient()
  const label = supplier.is_active ? "Nofaol qilish" : "Faollashtirish"
  const Icon = supplier.is_active ? EyeOffIcon : EyeIcon
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

  if (iconOnly) {
    return (
      <ActionTooltip label={label}>
        <Button
          variant="ghost"
          size="icon"
          className={iconAction}
          aria-label={`${label}: ${supplier.name}`}
          disabled={toggle.isPending}
          onClick={() => toggle.mutate()}
        >
          <Icon />
        </Button>
      </ActionTooltip>
    )
  }
  return (
    <PendingButton variant="outline" size="lg" className="px-3.5" pending={toggle.isPending} onClick={() => toggle.mutate()}>
      <Icon />
      {label}
    </PendingButton>
  )
}
