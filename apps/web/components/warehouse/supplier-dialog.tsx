"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { PhoneRow, TextRow } from "@/components/kit/form-row"
import { Group } from "@/components/kit/group"
import { MainButton } from "@/components/kit/main-button"
import { SheetForm } from "@/components/kit/sheet-form"
import { Refusal } from "@/components/refusal"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { api, call } from "@/lib/api"
import { supplierKey, suppliersKey } from "@/lib/queries"
import type { Supplier } from "@/lib/types"
import { type SupplierForm, type SupplierOutput, supplierDefaults, supplierSchema } from "@/lib/warehouse"

// SupplierDialog enters a supplier (logic/warehouse.md, 3.1), or saves the
// one given with other fields, as the prototype's sheet: its name, an
// Uzbek phone after +998 and a note. The page opens it (the list's round +,
// the supplier's «Tahrirlash» tile) and mounts it for each opening, so it
// starts from the supplier as it is now, or from an empty form.
export function SupplierDialog({
  companyId,
  supplier,
  open,
  onOpenChange,
}: {
  companyId: number
  supplier?: Supplier
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const form = useForm<SupplierForm, unknown, SupplierOutput>({
    resolver: zodResolver(supplierSchema),
    defaultValues: supplierDefaults(supplier),
  })
  const save = useMutation({
    mutationFn: (fields: SupplierOutput) =>
      supplier
        ? call(api.PUT("/app/suppliers/{id}", { params: { path: { id: supplier.id } }, body: fields }))
        : call(api.POST("/app/suppliers", { body: fields })),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: suppliersKey(companyId) })
      if (supplier) queryClient.setQueryData(supplierKey(companyId, supplier.id), saved)
      toast.success(supplier ? "Ta'minotchi saqlandi" : "Ta'minotchi qo'shildi")
      onOpenChange(false)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{supplier ? "Ta'minotchini tahrirlash" : "Ta'minotchi qo'shish"}</DialogTitle>
          <DialogDescription>Nom majburiy; telefon va izoh ixtiyoriy.</DialogDescription>
        </DialogHeader>
        <SheetForm onSubmit={form.handleSubmit((fields) => save.mutate(fields))}>
          {save.isError && <Refusal className="mb-4">{save.error.message}</Refusal>}
          <Group>
            <TextRow control={form.control} name="name" label="Nomi" placeholder="Masalan, Bozor" autoComplete="off" />
            <PhoneRow control={form.control} name="phone" />
            <TextRow control={form.control} name="note" label="Izoh" placeholder="ixtiyoriy" autoComplete="off" />
          </Group>
          <DialogFooter>
            <MainButton type="submit" pending={save.isPending}>
              {supplier ? "Saqlash" : "Qo'shish"}
            </MainButton>
          </DialogFooter>
        </SheetForm>
      </DialogContent>
    </Dialog>
  )
}
