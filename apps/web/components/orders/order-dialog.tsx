"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { ChoiceChips } from "@/components/kit/chips"
import { MainButton } from "@/components/kit/main-button"
import { SheetForm } from "@/components/kit/sheet-form"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { api, call } from "@/lib/api"
import { answersDefaults } from "@/lib/fields"
import { formatPhoneInput } from "@/lib/phone"
import { customerKey, customersKey, ordersKey } from "@/lib/queries"
import { type OrderForm, type OrderOutput, orderDefaults, orderSchema } from "@/lib/orders"
import type { Customer, CustomerDropdown, CustomerType, Member, OrderStage, OrderType } from "@/lib/types"
import { CustomerSection, FormSection, OrderFields, OrderRefusal } from "./order-form"

// AddOrderDialog enters an order into the company: the type on top, the
// customer on the left (one that is there, taken from the suggestions, or
// a new one entered with the order) and the order on the right. It is
// mounted to open and unmounted to close, so every opening starts afresh:
// on the type the list is narrowed to (or the first), in the stage it was
// opened for (or the first), with the deadline empty and nobody assigned.
export function AddOrderDialog({
  companyId,
  locationId,
  types,
  stages,
  customerTypes,
  canCreateCustomer,
  dropdowns,
  members,
  typeId: preferred,
  stageId,
  customer,
  onClose,
}: {
  companyId: number
  // locationId is the current location: the order is entered into it.
  locationId: number
  types: OrderType[]
  stages: OrderStage[]
  customerTypes: CustomerType[]
  // canCreateCustomer says whether the member may enter a new customer with
  // the order (customers.create); without it only a customer that is there
  // will do.
  canCreateCustomer: boolean
  dropdowns: CustomerDropdown[]
  members: Member[]
  // typeId is the type the list is narrowed to, if any; stageId the stage
  // the dialog was opened for, if any.
  typeId: number | null
  stageId: number | null
  // customer is the one the order is for, when it is known from the start
  // (the customer's page): it opens linked.
  customer?: Customer
  onClose: () => void
}) {
  const [typeId, setTypeId] = useState((types.find((candidate) => candidate.id === preferred) ?? types[0]).id)
  const type = types.find((candidate) => candidate.id === typeId) ?? types[0]
  const [customerTypeId, setCustomerTypeId] = useState<number | null>(customerTypes[0]?.id ?? null)
  // With no leave to enter a customer there is no type to enter one under:
  // the form takes a customer that is there alone.
  const customerType = canCreateCustomer ? (customerTypes.find((candidate) => candidate.id === customerTypeId) ?? customerTypes[0] ?? null) : null
  // linked is the customer that is there, taken for the order.
  const [linked, setLinked] = useState<Customer | null>(customer ?? null)
  // The customer known from the start fills the form's customer part, as a
  // customer taken from the suggestions does.
  const linkedDefaults = () => {
    const defaults = orderDefaults(type, customerType, stageId ?? stages[0]?.id ?? null)
    if (!customer) return defaults
    const linkedType = customerTypes.find((candidate) => candidate.id === customer.type_id)
    return {
      ...defaults,
      customer: { type_id: String(customer.type_id), phone: formatPhoneInput(customer.phone), values: answersDefaults(linkedType?.fields ?? [], customer.values) },
    }
  }
  const queryClient = useQueryClient()
  const form = useForm<OrderForm, unknown, OrderOutput>({
    resolver: zodResolver(orderSchema(type, customerType, linked?.id ?? null)),
    defaultValues: linkedDefaults(),
  })
  const add = useMutation({
    mutationFn: (order: OrderOutput) => call(api.POST("/app/orders", { body: { type_id: type.id, location_id: locationId, ...order } })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ordersKey(companyId) })
      // A new customer is among the customers now.
      queryClient.invalidateQueries({ queryKey: customersKey(companyId) })
      toast.success("Vazifa qo'shildi")
      onClose()
    },
  })

  // Another type is another form on the right: its fields start empty, and
  // the rest stays as it was typed.
  const changeType = (id: number) => {
    const next = types.find((candidate) => candidate.id === id)
    if (!next) return
    setTypeId(next.id)
    form.setValue("values", answersDefaults(next.fields))
  }

  // Another customer type is another form on the left: its fields start
  // empty, and the phone stays.
  const changeCustomerType = (id: number) => {
    const next = customerTypes.find((candidate) => candidate.id === id)
    if (!next) return
    setCustomerTypeId(next.id)
    form.setValue("customer.type_id", String(next.id))
    form.setValue("customer.values", answersDefaults(next.fields))
  }

  // link takes a customer that is there: the form shows it, filled in and
  // locked, and asks nothing more about it.
  const link = (customer: Customer) => {
    const linkedType = customerTypes.find((candidate) => candidate.id === customer.type_id)
    setLinked(customer)
    if (linkedType) setCustomerTypeId(linkedType.id)
    form.setValue("customer", {
      type_id: String(customer.type_id),
      phone: formatPhoneInput(customer.phone),
      values: answersDefaults(linkedType?.fields ?? [], customer.values),
    })
    form.clearErrors("customer")
    add.reset()
  }

  // linkById takes the customer the API named (the one who has the phone).
  const linkById = (id: number) =>
    queryClient
      .fetchQuery({ queryKey: customerKey(companyId, id), queryFn: () => call(api.GET("/app/customers/{id}", { params: { path: { id } } })) })
      .then(link, (error: Error) => toast.error(error.message))

  // unlink lets the customer go: the left starts again, empty.
  const unlink = () => {
    setLinked(null)
    form.setValue("customer", { type_id: customerType ? String(customerType.id) : "", phone: "", values: answersDefaults(customerType?.fields ?? []) })
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent tall>
        <DialogHeader>
          <DialogTitle>Vazifa qo&apos;shish</DialogTitle>
          <DialogDescription>Turni tanlang, mijozni biriktiring va vazifani to&apos;ldiring.</DialogDescription>
        </DialogHeader>
        <SheetForm onSubmit={form.handleSubmit((order) => add.mutate(order))}>
          {add.isError && <OrderRefusal error={add.error} onLink={linkById} />}
          {/* With one type there is nothing to choose. */}
          {types.length > 1 && (
            <ChoiceChips
              label="Vazifa turi"
              value={String(type.id)}
              onChange={(value) => changeType(Number(value))}
              options={types.map((candidate) => ({ value: String(candidate.id), label: candidate.name }))}
            />
          )}
          <FormSection legend="Mijoz">
            <CustomerSection
              control={form.control}
              companyId={companyId}
              customerTypes={customerTypes}
              customerType={customerType}
              canCreate={canCreateCustomer}
              onChangeType={changeCustomerType}
              dropdowns={dropdowns}
              linked={linked}
              onLink={link}
              onUnlink={unlink}
            />
          </FormSection>
          <FormSection legend="Vazifa">
            <OrderFields control={form.control} type={type} stages={stages} members={members} dropdowns={dropdowns} locationId={locationId} />
          </FormSection>
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
