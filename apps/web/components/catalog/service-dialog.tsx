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
import { type ServiceForm, type ServiceOutput, serviceDefaults, serviceSchema } from "@/lib/catalog"
import { productKey, productsKey } from "@/lib/queries"
import type { Product } from "@/lib/types"
import { iconAction } from "./icon-action"

// ServiceDialog enters a service (logic/products.md, section 4), or saves
// the one given with other fields: its name, its price and a note. A
// service has no unit and no SKU.
export function ServiceDialog({ companyId, service, iconOnly = false }: { companyId: number; service?: Product; iconOnly?: boolean }) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const form = useForm<ServiceForm, unknown, ServiceOutput>({
    resolver: zodResolver(serviceSchema),
    defaultValues: serviceDefaults(service),
  })
  const save = useMutation({
    mutationFn: (fields: ServiceOutput) =>
      service
        ? call(api.PUT("/app/products/{id}", { params: { path: { id: service.id } }, body: fields }))
        : call(api.POST("/app/products", { body: { kind: "service", ...fields } })),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: productsKey(companyId) })
      if (service) queryClient.setQueryData(productKey(companyId, service.id), saved)
      toast.success(service ? "Xizmat saqlandi" : "Xizmat qo'shildi")
      setOpen(false)
    },
  })

  // Every opening starts from the service as it is now, or from an empty form.
  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (next) {
      form.reset(serviceDefaults(service))
      save.reset()
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      {service && iconOnly ? (
        <ActionTooltip label="Tahrirlash">
          <DialogTrigger render={<Button variant="ghost" size="icon" className={iconAction} aria-label={`Tahrirlash: ${service.name}`} />}>
            <PencilIcon />
          </DialogTrigger>
        </ActionTooltip>
      ) : (
        <DialogTrigger render={<Button size="lg" className="px-3.5" />}>
          {service ? <PencilIcon /> : <PlusIcon />}
          {service ? "Tahrirlash" : "Xizmat qo'shish"}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{service ? "Xizmatni tahrirlash" : "Xizmat qo'shish"}</DialogTitle>
          <DialogDescription>Nom majburiy; narx va izoh ixtiyoriy.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((fields) => save.mutate(fields))} noValidate className="space-y-4">
          <FieldGroup>
            <TextField control={form.control} name="name" label="Nomi" autoComplete="off" />
            <TextField control={form.control} name="price" label="Narx" inputMode="decimal" autoComplete="off" />
            <TextField control={form.control} name="note" label="Izoh" autoComplete="off" />
          </FieldGroup>
          {save.isError && <Refusal>{save.error.message}</Refusal>}
          <DialogFooter>
            <PendingButton type="submit" size="lg" className="px-3.5 max-sm:h-10" pending={save.isPending}>
              {service ? "Saqlash" : "Qo'shish"}
            </PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
