"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { EyeIcon, EyeOffIcon } from "lucide-react"
import { toast } from "sonner"
import { Tile } from "@/components/kit/detail-head"
import { api, call } from "@/lib/api"
import { nounOf } from "@/lib/catalog"
import { productKey, productsKey } from "@/lib/queries"
import type { Product } from "@/lib/types"

// useProductActive turns a product or a service off (it is no longer
// offered, its name stays taken; logic/products.md, 3.3) or on again, and
// says which: the page's tile and a service's sheet of actions in the list
// both ask it.
export function useProductActive(companyId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (product: Product) =>
      call(api.PATCH("/app/products/{id}", { params: { path: { id: product.id } }, body: { is_active: !product.is_active } })),
    onSuccess: (saved, product) => {
      queryClient.invalidateQueries({ queryKey: productsKey(companyId) })
      // The page's product carries its stock, which the answer does not:
      // the fields change, the stock stays.
      queryClient.setQueryData<Product>(productKey(companyId, product.id), (old) => (old ? { ...old, ...saved } : old))
      toast.success(`${nounOf(product.kind)} ${saved.is_active ? "faollashtirildi" : "nofaol qilindi"}`)
    },
    onError: (error) => toast.error(error.message),
  })
}

// ActiveButton is the tile on a product's page that turns it off, or on
// again.
export function ActiveButton({ companyId, product }: { companyId: number; product: Product }) {
  const toggle = useProductActive(companyId)
  return (
    <Tile
      icon={product.is_active ? EyeOffIcon : EyeIcon}
      label={product.is_active ? "Nofaol qilish" : "Faollashtirish"}
      disabled={toggle.isPending}
      onClick={() => toggle.mutate(product)}
    />
  )
}
