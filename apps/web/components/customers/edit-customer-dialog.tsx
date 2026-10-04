"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { PencilIcon } from "lucide-react"
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
import { customerHistoryKey, customerKey, customersKey } from "@/lib/queries"
import type { Customer, CustomerDropdown, CustomerType } from "@/lib/types"
import { CustomerFields, CustomerRefusal } from "./customer-form"

// EditCustomerDialog saves a customer with another phone and other answers.
// Its type was chosen when it was entered and stays: the dialog says it, and
// asks the fields of that type. An answer left empty is taken away.
export function EditCustomerDialog({
  companyId,
  customer,
  type,
  dropdowns,
}: {
  companyId: number
  customer: Customer
  type: CustomerType
  dropdowns: CustomerDropdown[]
}) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const form = useForm<CustomerForm, unknown, CustomerOutput>({
    resolver: zodResolver(customerSchema(type)),
    defaultValues: formDefaults(type, customer),
  })
  const save = useMutation({
    mutationFn: (edited: CustomerOutput) =>
      call(api.PUT("/app/customers/{id}", { params: { path: { id: customer.id } }, body: edited })),
    onSuccess: (saved) => {
      // The page shows the answer at once; the lists ask again.
      queryClient.setQueryData(customerKey(companyId, customer.id), saved)
      queryClient.invalidateQueries({ queryKey: customersKey(companyId) })
      queryClient.invalidateQueries({ queryKey: customerHistoryKey(companyId, customer.id) })
      toast.success("Mijoz saqlandi")
      setOpen(false)
    },
  })

  // Every opening starts from the customer as it is now.
  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (next) {
      form.reset(formDefaults(type, customer))
      save.reset()
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger render={<Button size="lg" className="px-3.5" />}>
        <PencilIcon />
        Tahrirlash
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mijozni tahrirlash</DialogTitle>
          <DialogDescription>{type.name}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((edited) => save.mutate(edited))} noValidate className="space-y-4">
          <CustomerFields control={form.control} type={type} dropdowns={dropdowns} customer={customer} />
          {save.isError && <CustomerRefusal error={save.error} />}
          <DialogFooter>
            <PendingButton type="submit" size="lg" className="px-3.5 max-sm:h-10" pending={save.isPending}>
              Saqlash
            </PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
