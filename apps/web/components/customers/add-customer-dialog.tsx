"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { PlusIcon } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { ChoiceChips } from "@/components/kit/chips"
import { MainButton } from "@/components/kit/main-button"
import { SheetForm } from "@/components/kit/sheet-form"
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
  open: openGiven,
  onOpenChange,
}: {
  companyId: number
  types: CustomerType[]
  dropdowns: CustomerDropdown[]
  // typeId is the type the list is narrowed to, if any.
  typeId: number | null
  // open, with onOpenChange, opens the dialog from outside (the home's
  // «Mijoz» tile): it has no button then, and every mounting starts afresh.
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [openOwn, setOpenOwn] = useState(false)
  const controlled = openGiven !== undefined
  const open = controlled ? openGiven : openOwn
  const setOpen = (next: boolean) => (controlled ? onOpenChange?.(next) : setOpenOwn(next))
  // It opens on the type the list is narrowed to (or the first): mounted
  // open from outside as well as opened by its button.
  const [typeId, setTypeId] = useState((types.find((candidate) => candidate.id === preferred) ?? types[0]).id)
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
      {!controlled && (
        <DialogTrigger render={<Button size="lg" className="px-3.5" />}>
          <PlusIcon />
          Mijoz qo&apos;shish
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mijoz qo&apos;shish</DialogTitle>
          <DialogDescription>Turni tanlang va shu turning maydonlarini to&apos;ldiring.</DialogDescription>
        </DialogHeader>
        <SheetForm onSubmit={form.handleSubmit((customer) => add.mutate(customer))}>
          {/* With one type there is nothing to choose. */}
          {types.length > 1 && (
            <ChoiceChips
              label="Mijoz turi"
              value={String(type.id)}
              onChange={(value) => changeType(Number(value))}
              options={types.map((candidate) => ({ value: String(candidate.id), label: candidate.name }))}
            />
          )}
          <CustomerFields control={form.control} type={type} dropdowns={dropdowns} />
          {add.isError && <CustomerRefusal error={add.error} />}
          <DialogFooter>
            <MainButton type="submit" pending={add.isPending}>
              Qo&apos;shish
            </MainButton>
          </DialogFooter>
        </SheetForm>
      </DialogContent>
    </Dialog>
  )
}
