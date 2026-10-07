"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { EyeIcon, EyeOffIcon } from "lucide-react"
import { toast } from "sonner"
import { ActionTooltip } from "@/components/action-tooltip"
import { PendingButton } from "@/components/pending-button"
import { Button } from "@/components/ui/button"
import { api, call } from "@/lib/api"
import { productKey, productsKey } from "@/lib/queries"
import type { Product } from "@/lib/types"
import { iconAction, nounOf } from "./icon-action"

// ActiveButton turns a product or a service off (it is no longer offered,
// its name stays taken; logic/products.md, 3.3) or on again: on a page as
// a full button, in a list's row as an icon.
export function ActiveButton({ companyId, product, iconOnly = false }: { companyId: number; product: Product; iconOnly?: boolean }) {
  const queryClient = useQueryClient()
  const label = product.is_active ? "Nofaol qilish" : "Faollashtirish"
  const Icon = product.is_active ? EyeOffIcon : EyeIcon
  const toggle = useMutation({
    mutationFn: () =>
      call(api.PATCH("/app/products/{id}", { params: { path: { id: product.id } }, body: { is_active: !product.is_active } })),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: productsKey(companyId) })
      // The page's product carries its stock, which the answer does not:
      // the fields change, the stock stays.
      queryClient.setQueryData<Product>(productKey(companyId, product.id), (old) => (old ? { ...old, ...saved } : old))
      toast.success(`${nounOf(product.kind)} ${saved.is_active ? "faollashtirildi" : "nofaol qilindi"}`)
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
          aria-label={`${label}: ${product.name}`}
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
