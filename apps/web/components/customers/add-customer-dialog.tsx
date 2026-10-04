"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Radio } from "@base-ui/react/radio"
import { RadioGroup } from "@base-ui/react/radio-group"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { PlusIcon } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { PendingButton } from "@/components/pending-button"
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
import { api, call } from "@/lib/api"
import { type CustomerForm, type CustomerOutput, customerSchema, formDefaults } from "@/lib/customers"
import { customersKey } from "@/lib/queries"
import type { CustomerDropdown, CustomerType } from "@/lib/types"
import { CustomerFields, CustomerRefusal } from "./customer-form"

// AddCustomerDialog enters a customer into the company. The type is chosen
// first, by its button: its fields are the form, after the phone that every
// customer has. It opens on the type the list is showing, or the first one.
export function AddCustomerDialog({
  companyId,
  types,
  dropdowns,
  typeId: preferred,
}: {
  companyId: number
  types: CustomerType[]
  dropdowns: CustomerDropdown[]
  // typeId is the type the list is narrowed to, if any.
  typeId: number | null
}) {
  const [open, setOpen] = useState(false)
  const [typeId, setTypeId] = useState(types[0].id)
  const type = types.find((candidate) => candidate.id === typeId) ?? types[0]
  const queryClient = useQueryClient()
  const form = useForm<CustomerForm, unknown, CustomerOutput>({
    resolver: zodResolver(customerSchema(type)),
    defaultValues: formDefaults(type),
  })
  const add = useMutation({
    mutationFn: (customer: CustomerOutput) => call(api.POST("/app/customers", { body: { type_id: type.id, ...customer } })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customersKey(companyId) })
      toast.success("Mijoz qo'shildi")
      setOpen(false)
    },
  })

  // Every opening starts from an empty form of the type the list shows.
  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (next) {
      const first = types.find((candidate) => candidate.id === preferred) ?? types[0]
      setTypeId(first.id)
      form.reset(formDefaults(first))
      add.reset()
    }
  }

  // Another type is another form: its fields start empty, and the phone,
  // which every type has, stays as it was typed.
  const changeType = (id: number) => {
    const next = types.find((candidate) => candidate.id === id)
    if (!next) return
    setTypeId(next.id)
    form.reset({ ...formDefaults(next), phone: form.getValues("phone") })
    add.reset()
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger render={<Button size="lg" className="px-3.5" />}>
        <PlusIcon />
        Mijoz qo&apos;shish
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mijoz qo&apos;shish</DialogTitle>
          <DialogDescription>Turni tanlang va shu turning maydonlarini to&apos;ldiring.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((customer) => add.mutate(customer))} noValidate className="space-y-4">
          {/* With one type there is nothing to choose. */}
          {types.length > 1 && (
            <RadioGroup
              aria-label="Mijoz turi"
              value={String(type.id)}
              onValueChange={(value) => changeType(Number(value))}
              className="flex w-fit max-w-full flex-wrap gap-1 rounded-lg bg-muted p-[3px]"
            >
              {types.map((candidate) => (
                <Radio.Root
                  key={candidate.id}
                  value={String(candidate.id)}
                  className="inline-flex h-8 cursor-default items-center rounded-md px-3 text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:bg-card data-checked:text-foreground data-checked:shadow-sm"
                >
                  {candidate.name}
                </Radio.Root>
              ))}
            </RadioGroup>
          )}
          <CustomerFields control={form.control} type={type} dropdowns={dropdowns} />
          {add.isError && <CustomerRefusal error={add.error} />}
          <DialogFooter>
            <PendingButton type="submit" size="lg" className="px-3.5 max-sm:h-10" pending={add.isPending}>
              Qo&apos;shish
            </PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
