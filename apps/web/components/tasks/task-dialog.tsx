"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Radio } from "@base-ui/react/radio"
import { RadioGroup } from "@base-ui/react/radio-group"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { PendingButton } from "@/components/pending-button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { api, call } from "@/lib/api"
import { answersDefaults } from "@/lib/fields"
import { formatPhoneInput } from "@/lib/phone"
import { customerKey, customersKey, tasksKey } from "@/lib/queries"
import { type TaskForm, type TaskOutput, taskDefaults, taskSchema } from "@/lib/tasks"
import type { Customer, CustomerDropdown, CustomerType, Member, TaskStage, TaskType } from "@/lib/types"
import { choice, choices, CustomerSection, TaskFields, TaskRefusal } from "./task-form"

// AddTaskDialog enters a task into the company: the type on top, the
// customer on the left (one that is there, taken from the suggestions, or
// a new one entered with the task) and the task on the right. It is
// mounted to open and unmounted to close, so every opening starts afresh:
// on the type the list is narrowed to (or the first), in the stage it was
// opened for (or the first), with the deadline empty and nobody assigned.
export function AddTaskDialog({
  companyId,
  types,
  stages,
  customerTypes,
  canCreateCustomer,
  dropdowns,
  members,
  typeId: preferred,
  stageId,
  onClose,
}: {
  companyId: number
  types: TaskType[]
  stages: TaskStage[]
  customerTypes: CustomerType[]
  // canCreateCustomer says whether the member may enter a new customer with
  // the task (customers.create); without it only a customer that is there
  // will do.
  canCreateCustomer: boolean
  dropdowns: CustomerDropdown[]
  members: Member[]
  // typeId is the type the list is narrowed to, if any; stageId the stage
  // the dialog was opened for, if any.
  typeId: number | null
  stageId: number | null
  onClose: () => void
}) {
  const [typeId, setTypeId] = useState((types.find((candidate) => candidate.id === preferred) ?? types[0]).id)
  const type = types.find((candidate) => candidate.id === typeId) ?? types[0]
  const [customerTypeId, setCustomerTypeId] = useState<number | null>(customerTypes[0]?.id ?? null)
  // With no leave to enter a customer there is no type to enter one under:
  // the form takes a customer that is there alone.
  const customerType = canCreateCustomer ? (customerTypes.find((candidate) => candidate.id === customerTypeId) ?? customerTypes[0] ?? null) : null
  // linked is the customer that is there, taken for the task.
  const [linked, setLinked] = useState<Customer | null>(null)
  const queryClient = useQueryClient()
  const form = useForm<TaskForm, unknown, TaskOutput>({
    resolver: zodResolver(taskSchema(type, customerType, linked?.id ?? null)),
    defaultValues: taskDefaults(type, customerType, stageId ?? stages[0]?.id ?? null),
  })
  const add = useMutation({
    mutationFn: (task: TaskOutput) => call(api.POST("/app/tasks", { body: { type_id: type.id, ...task } })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksKey(companyId) })
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
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Vazifa qo&apos;shish</DialogTitle>
          <DialogDescription>Turni tanlang, mijozni biriktiring va vazifani to&apos;ldiring.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((task) => add.mutate(task))} noValidate className="space-y-4">
          {/* With one type there is nothing to choose. */}
          {types.length > 1 && (
            <RadioGroup aria-label="Vazifa turi" value={String(type.id)} onValueChange={(value) => changeType(Number(value))} className={choices}>
              {types.map((candidate) => (
                <Radio.Root key={candidate.id} value={String(candidate.id)} className={choice}>
                  {candidate.name}
                </Radio.Root>
              ))}
            </RadioGroup>
          )}
          <div className="grid gap-6 md:grid-cols-2">
            <fieldset className="min-w-0">
              <legend className="mb-3 text-sm font-semibold">Mijoz</legend>
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
            </fieldset>
            <fieldset className="min-w-0">
              <legend className="mb-3 text-sm font-semibold">Vazifa</legend>
              <TaskFields control={form.control} type={type} stages={stages} members={members} dropdowns={dropdowns} />
            </fieldset>
          </div>
          {add.isError && <TaskRefusal error={add.error} onLink={linkById} />}
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
