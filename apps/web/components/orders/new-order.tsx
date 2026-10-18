"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useCustomerDropdowns, useCustomerTypes, useMembers, useOrderStages, useOrderTypes } from "@/lib/queries"
import type { Customer } from "@/lib/types"
import { AddOrderDialog } from "./order-dialog"

// NewOrder opens the order dialog away from the orders page (the home's tile,
// a customer's page) once what it asks is known; a company with no order
// type or stage yet is taken to the orders, which say what to set up.
// customer is the one the order is for, when it is known from the start.
export function NewOrder({
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
  const types = useOrderTypes(companyId)
  const stages = useOrderStages(companyId)
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
    <AddOrderDialog
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
