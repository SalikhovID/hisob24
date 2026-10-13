"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { AmountRow, TextRow } from "@/components/kit/form-row"
import { Group } from "@/components/kit/group"
import { MainButton } from "@/components/kit/main-button"
import { SelectRow } from "@/components/kit/picker-sheet"
import { SheetForm } from "@/components/kit/sheet-form"
import { Refusal } from "@/components/refusal"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { api, call } from "@/lib/api"
import { type ProductForm, type ProductOutput, productDefaults, productSchema, units } from "@/lib/catalog"
import { currencyOf, currencyOptions, isMulti, useCurrencies } from "@/lib/currencies"
import { productKey, productsKey } from "@/lib/queries"
import type { Product } from "@/lib/types"

// ProductDialog enters a product (logic/products.md, section 4), or saves
// the one given with other fields, as the prototype's sheet: its name, its
// unit chosen in a sheet of its own, its sale price (in its currency when
// the company works in more than the so'm), its SKU and a note. The page
// opens it (the round + of the list, the «Tahrirlash» tile of the product)
// and mounts it for each opening, so it starts from the product as it is
// now, or from an empty form. The kind was set on entry and stays.
export function ProductDialog({
  companyId,
  product,
  open,
  onOpenChange,
}: {
  companyId: number
  product?: Product
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const currencies = useCurrencies()
  const form = useForm<ProductForm, unknown, ProductOutput>({
    resolver: zodResolver(productSchema),
    defaultValues: productDefaults(product),
  })
  const currencyId = Number(useWatch({ control: form.control, name: "currency_id" }))
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
      onOpenChange(false)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{product ? "Mahsulotni tahrirlash" : "Mahsulot qo'shish"}</DialogTitle>
          <DialogDescription>Nom va birlik majburiy; sotuv narxi, artikul va izoh ixtiyoriy.</DialogDescription>
        </DialogHeader>
        <SheetForm onSubmit={form.handleSubmit((fields) => save.mutate(fields))}>
          {save.isError && <Refusal className="mb-4">{save.error.message}</Refusal>}
          <Group>
            <TextRow control={form.control} name="name" label="Nomi" placeholder="Masalan, Olma" autoComplete="off" />
            <SelectRow control={form.control} name="unit" label="Birlik" options={units} />
            <AmountRow
              control={form.control}
              name="price"
              label="Sotuv narxi"
              placeholder="ixtiyoriy"
              suffix={currencyOf(currencies, currencyId).symbol}
            />
            {isMulti(currencies) && <SelectRow control={form.control} name="currency_id" label="Valyuta" options={currencyOptions(currencies)} />}
            <TextRow control={form.control} name="sku" label="Artikul" placeholder="ixtiyoriy" autoComplete="off" />
            <TextRow control={form.control} name="note" label="Izoh" placeholder="ixtiyoriy" autoComplete="off" />
          </Group>
          <DialogFooter>
            <MainButton type="submit" pending={save.isPending}>
              {product ? "Saqlash" : "Qo'shish"}
            </MainButton>
          </DialogFooter>
        </SheetForm>
      </DialogContent>
    </Dialog>
  )
}
