"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { PencilIcon, PlusIcon } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { ActionTooltip } from "@/components/action-tooltip"
import { iconAction } from "@/components/catalog/icon-action"
import { PendingButton } from "@/components/pending-button"
import { PhoneField } from "@/components/phone-field"
import { Refusal } from "@/components/refusal"
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
import { supplierKey, suppliersKey } from "@/lib/queries"
import type { Supplier } from "@/lib/types"
import { type SupplierForm, type SupplierOutput, supplierDefaults, supplierSchema } from "@/lib/warehouse"

// SupplierDialog enters a supplier (logic/warehouse.md, 3.1), or saves the
// one given with other fields: its name, an Uzbek phone and a note.
export function SupplierDialog({ companyId, supplier, iconOnly = false }: { companyId: number; supplier?: Supplier; iconOnly?: boolean }) {
  const [open, setOpen] = useState(false)
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
      setOpen(false)
    },
  })

  // Every opening starts from the supplier as it is now, or from an empty form.
  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (next) {
      form.reset(supplierDefaults(supplier))
      save.reset()
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      {supplier && iconOnly ? (
        <ActionTooltip label="Tahrirlash">
          <DialogTrigger render={<Button variant="ghost" size="icon" className={iconAction} aria-label={`Tahrirlash: ${supplier.name}`} />}>
            <PencilIcon />
          </DialogTrigger>
        </ActionTooltip>
      ) : (
        <DialogTrigger render={<Button size="lg" className="px-3.5" />}>
          {supplier ? <PencilIcon /> : <PlusIcon />}
          {supplier ? "Tahrirlash" : "Ta'minotchi qo'shish"}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{supplier ? "Ta'minotchini tahrirlash" : "Ta'minotchi qo'shish"}</DialogTitle>
          <DialogDescription>Nom majburiy; telefon va izoh ixtiyoriy.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((fields) => save.mutate(fields))} noValidate className="space-y-4">
          <FieldGroup>
            <TextField control={form.control} name="name" label="Nomi" autoComplete="off" />
            <PhoneField control={form.control} name="phone" label="Telefon" autoComplete="off" />
            <TextField control={form.control} name="note" label="Izoh" autoComplete="off" />
          </FieldGroup>
          {save.isError && <Refusal>{save.error.message}</Refusal>}
          <DialogFooter>
            <PendingButton type="submit" size="lg" className="px-3.5 max-sm:h-10" pending={save.isPending}>
              {supplier ? "Saqlash" : "Qo'shish"}
            </PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
