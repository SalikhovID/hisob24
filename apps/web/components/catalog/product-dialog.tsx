"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { PencilIcon, PlusIcon } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { ActionTooltip } from "@/components/action-tooltip"
import { PendingButton } from "@/components/pending-button"
import { Refusal } from "@/components/refusal"
import { SelectField } from "@/components/select-field"
import { TextField } from "@/components/text-field"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { FieldGroup } from "@/components/ui/field"
import { api, call } from "@/lib/api"
import { type ProductForm, type ProductOutput, productDefaults, productSchema, units } from "@/lib/catalog"
import { productKey, productsKey } from "@/lib/queries"
import type { Product } from "@/lib/types"
import { iconAction } from "./icon-action"

// ProductDialog enters a product (logic/products.md, section 4), or saves
// the one given with other fields: its name, its unit from the list, its
// sale price, its SKU and a note. The kind was set on entry and stays.
export function ProductDialog({ companyId, product, iconOnly = false }: { companyId: number; product?: Product; iconOnly?: boolean }) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const form = useForm<ProductForm, unknown, ProductOutput>({
    resolver: zodResolver(productSchema),
    defaultValues: productDefaults(product),
  })
  const save = useMutation({
    mutationFn: (fields: ProductOutput) =>
      product
        ? call(api.PUT("/app/products/{id}", { params: { path: { id: product.id } }, body: fields }))
        : call(api.POST("/app/products", { body: { kind: "product", ...fields } })),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: productsKey(companyId) })
      // The page's product carries its stock, which the answer does not:
      // the fields change, the stock stays.
      if (product) queryClient.setQueryData<Product>(productKey(companyId, product.id), (old) => (old ? { ...old, ...saved } : old))
      toast.success(product ? "Mahsulot saqlandi" : "Mahsulot qo'shildi")
      setOpen(false)
    },
  })

  // Every opening starts from the product as it is now, or from an empty form.
  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (next) {
      form.reset(productDefaults(product))
      save.reset()
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      {product && iconOnly ? (
        <ActionTooltip label="Tahrirlash">
          <DialogTrigger render={<Button variant="ghost" size="icon" className={iconAction} aria-label={`Tahrirlash: ${product.name}`} />}>
            <PencilIcon />
          </DialogTrigger>
        </ActionTooltip>
      ) : (
        <DialogTrigger render={<Button size="lg" className="px-3.5" />}>
          {product ? <PencilIcon /> : <PlusIcon />}
          {product ? "Tahrirlash" : "Mahsulot qo'shish"}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{product ? "Mahsulotni tahrirlash" : "Mahsulot qo'shish"}</DialogTitle>
          <DialogDescription>Nom va birlik majburiy; sotuv narxi, artikul va izoh ixtiyoriy.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((fields) => save.mutate(fields))} noValidate className="space-y-4">
          <FieldGroup>
            <TextField control={form.control} name="name" label="Nomi" autoComplete="off" />
            <SelectField control={form.control} name="unit" label="Birlik" placeholder="Tanlang" options={units} />
            <TextField control={form.control} name="price" label="Sotuv narxi" inputMode="decimal" autoComplete="off" />
            <TextField control={form.control} name="sku" label="Artikul" autoComplete="off" />
            <TextField control={form.control} name="note" label="Izoh" autoComplete="off" />
          </FieldGroup>
          {save.isError && <Refusal>{save.error.message}</Refusal>}
          <DialogFooter>
            <PendingButton type="submit" size="lg" className="px-3.5 max-sm:h-10" pending={save.isPending}>
              {product ? "Saqlash" : "Qo'shish"}
            </PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
