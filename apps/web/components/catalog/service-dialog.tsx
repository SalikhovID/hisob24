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
import { type ServiceForm, type ServiceOutput, serviceDefaults, serviceSchema } from "@/lib/catalog"
import { currencyOf, currencyOptions, isMulti, useCurrencies } from "@/lib/currencies"
import { productKey, productsKey } from "@/lib/queries"
import type { Product } from "@/lib/types"

// ServiceDialog enters a service (logic/products.md, section 4), or saves
// the one given, as the prototype's sheet: its name, its price (in its
// currency when the company works in more than the so'm) and a note; a
// service has no unit and no SKU. The list opens it (its round + or a
// service's «Tahrirlash») and mounts it for each opening.
export function ServiceDialog({
  companyId,
  service,
  open,
  onOpenChange,
}: {
  companyId: number
  service?: Product
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const currencies = useCurrencies()
  const form = useForm<ServiceForm, unknown, ServiceOutput>({
    resolver: zodResolver(serviceSchema),
    defaultValues: serviceDefaults(service),
  })
  const currencyId = Number(useWatch({ control: form.control, name: "currency_id" }))
  const save = useMutation({
    mutationFn: (fields: ServiceOutput) =>
      service
        ? call(api.PUT("/app/products/{id}", { params: { path: { id: service.id } }, body: fields }))
        : call(api.POST("/app/products", { body: { kind: "service", ...fields } })),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: productsKey(companyId) })
      if (service) queryClient.setQueryData(productKey(companyId, service.id), saved)
      toast.success(service ? "Xizmat saqlandi" : "Xizmat qo'shildi")
      onOpenChange(false)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{service ? "Xizmatni tahrirlash" : "Xizmat qo'shish"}</DialogTitle>
          <DialogDescription>Nom majburiy; narx va izoh ixtiyoriy.</DialogDescription>
        </DialogHeader>
        <SheetForm onSubmit={form.handleSubmit((fields) => save.mutate(fields))}>
          {save.isError && <Refusal className="mb-4">{save.error.message}</Refusal>}
          <Group>
            <TextRow control={form.control} name="name" label="Nomi" placeholder="Masalan, Yetkazib berish" autoComplete="off" />
            <AmountRow control={form.control} name="price" label="Narx" placeholder="ixtiyoriy" suffix={currencyOf(currencies, currencyId).symbol} />
            {isMulti(currencies) && <SelectRow control={form.control} name="currency_id" label="Valyuta" options={currencyOptions(currencies)} />}
            <TextRow control={form.control} name="note" label="Izoh" placeholder="ixtiyoriy" autoComplete="off" />
          </Group>
          <DialogFooter>
            <MainButton type="submit" pending={save.isPending}>
              {service ? "Saqlash" : "Qo'shish"}
            </MainButton>
          </DialogFooter>
        </SheetForm>
      </DialogContent>
    </Dialog>
  )
}
