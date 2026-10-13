"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useCustomerDropdowns, useCustomerTypes, useMembers, useTaskStages, useTaskTypes } from "@/lib/queries"
import type { Customer } from "@/lib/types"
import { AddTaskDialog } from "./task-dialog"

// NewTask opens the task dialog away from the tasks page (the home's tile,
// a customer's page) once what it asks is known; a company with no task
// type or stage yet is taken to the tasks, which say what to set up.
// customer is the one the task is for, when it is known from the start.
export function NewTask({
  companyId,
  locationId,
  canCreateCustomer,
  customer,
  onClose,
}: {
  companyId: number
  locationId: number
  canCreateCustomer: boolean
  customer?: Customer
  onClose: () => void
}) {
  const router = useRouter()
  const types = useTaskTypes(companyId)
  const stages = useTaskStages(companyId)
  const customerTypes = useCustomerTypes(companyId)
  const dropdowns = useCustomerDropdowns(companyId)
  const members = useMembers(companyId)
  const ready = types.data && stages.data && customerTypes.data && dropdowns.data && members.data
  const unset = ready && (types.data!.length === 0 || stages.data!.length === 0)
  useEffect(() => {
    if (unset) router.push("/tasks")
  }, [unset, router])
  if (!ready || unset) return null
  return (
    <AddTaskDialog
      companyId={companyId}
      locationId={locationId}
      types={types.data!}
      stages={stages.data!}
      customerTypes={customerTypes.data!}
      canCreateCustomer={canCreateCustomer}
      dropdowns={dropdowns.data!}
      members={members.data!}
      typeId={null}
      stageId={null}
      customer={customer}
      onClose={onClose}
    />
  )
}
