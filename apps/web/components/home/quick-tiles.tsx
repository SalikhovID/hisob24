"use client"

import { BanknoteIcon, ClipboardPlusIcon, PackagePlusIcon, ShoppingBagIcon, UserPlusIcon } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { AddCustomerDialog } from "@/components/customers/add-customer-dialog"
import { Tile, Tiles } from "@/components/kit/detail-head"
import { SearchPickerSheet } from "@/components/kit/picker-sheet"
import { NewTask } from "@/components/tasks/new-task"
import { PaymentDialog } from "@/components/warehouse/payment-dialog"
import { formatPhone } from "@/lib/phone"
import {
  dashboardKey,
  useCustomerDropdowns,
  useCustomerTypes,
  useSupplierSuggestions,
  useSuppliers,
} from "@/lib/queries"
import type { Permission } from "@/lib/types"

type Open = null | "task" | "customer" | "payment"

// QuickTiles are the home's quick actions, as the prototype's tiles: the
// first four of Vazifa, Mijoz, Sotuv, Xarid and To'lov the member may use
// (what goes into a location wants one). A task, a customer and a payment
// are entered right on the home; a sale and a purchase are a page each.
// To'lov picks the supplier among the active ones first. Whatever is
// entered shows on the home at once: the dashboard is asked again as a
// dialog closes.
export function QuickTiles({ companyId, locationId, permissions }: { companyId: number; locationId: number | null; permissions: Permission[] }) {
  const can = (permission: Permission) => permissions.includes(permission)
  const queryClient = useQueryClient()
  const [open, setOpen] = useState<Open>(null)
  const [supplierId, setSupplierId] = useState<number | null>(null)
  const located = locationId !== null
  const payable = can("purchases.create") && can("suppliers.view")
  const tiles = [
    can("tasks.create") && can("customers.view") && located && <Tile key="task" icon={ClipboardPlusIcon} label="Vazifa" onClick={() => setOpen("task")} />,
    can("customers.create") && <Tile key="customer" icon={UserPlusIcon} label="Mijoz" onClick={() => setOpen("customer")} />,
    can("sales.create") && located && <Tile key="sale" icon={ShoppingBagIcon} label="Sotuv" href="/sales/new" />,
    payable && located && <Tile key="purchase" icon={PackagePlusIcon} label="Xarid" href="/purchases/new" />,
    payable && <Tile key="payment" icon={BanknoteIcon} label="To'lov" onClick={() => setOpen("payment")} />,
  ]
    .filter(Boolean)
    .slice(0, 4)
  if (tiles.length === 0) return null
  const refresh = () => queryClient.invalidateQueries({ queryKey: dashboardKey(companyId) })
  const close = () => {
    setOpen(null)
    refresh()
  }

  return (
    <>
      <Tiles label="Tezkor amallar" className="mb-6">
        {tiles}
      </Tiles>
      {open === "task" && locationId !== null && (
        <NewTask companyId={companyId} locationId={locationId} canCreateCustomer={can("customers.create")} onClose={close} />
      )}
      {open === "customer" && <HomeAddCustomer companyId={companyId} onClose={close} />}
      {open === "payment" && (
        <SupplierPicker
          companyId={companyId}
          onClose={close}
          onPick={(id) => {
            setOpen(null)
            setSupplierId(id)
          }}
        />
      )}
      {supplierId !== null && (
        <PaymentDialog
          companyId={companyId}
          partyId={supplierId}
          open
          onOpenChange={(next) => {
            if (next) return
            setSupplierId(null)
            refresh()
          }}
        />
      )}
    </>
  )
}

// HomeAddCustomer opens the customer dialog once the types are known; a
// company with no customer type yet is taken to the customers.
function HomeAddCustomer({ companyId, onClose }: { companyId: number; onClose: () => void }) {
  const router = useRouter()
  const types = useCustomerTypes(companyId)
  const dropdowns = useCustomerDropdowns(companyId)
  const unset = types.data !== undefined && types.data.length === 0
  useEffect(() => {
    if (unset) router.push("/customers")
  }, [unset, router])
  if (!types.data || !dropdowns.data || unset) return null
  return <AddCustomerDialog companyId={companyId} types={types.data} dropdowns={dropdowns.data} typeId={null} open onOpenChange={(next) => !next && onClose()} />
}

// SupplierPicker is the sheet the payment's supplier is picked in: the
// active suppliers, or those a search finds.
function SupplierPicker({ companyId, onPick, onClose }: { companyId: number; onPick: (id: number) => void; onClose: () => void }) {
  const [query, setQuery] = useState("")
  const active = useSuppliers(companyId, { status: "active", search: "", page: 1 })
  const found = useSupplierSuggestions(companyId, query)
  const list = query.trim() ? found : active
  const options = (list.data?.items ?? []).map((s) => ({ value: String(s.id), label: s.name, sub: s.phone ? formatPhone(s.phone) : undefined }))
  return (
    <SearchPickerSheet
      open
      onOpenChange={(next) => !next && onClose()}
      title="Ta'minotchi"
      placeholder="Ta'minotchini qidirish"
      query={query}
      onQuery={setQuery}
      options={options}
      value=""
      onChange={(value) => onPick(Number(value))}
      loading={list.isPending}
      emptyText="Ta'minotchi topilmadi"
    />
  )
}
