"use client"

import { ArrowDownLeftIcon, ClipboardPlusIcon, PackagePlusIcon, ShoppingCartIcon, UserPlusIcon } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { AddCustomerDialog } from "@/components/customers/add-customer-dialog"
import { ExpenseDialog } from "@/components/finance/expense-dialog"
import { Tile, Tiles } from "@/components/kit/detail-head"
import { NewOrder } from "@/components/orders/new-order"
import { dashboardKey, useCustomerDropdowns, useCustomerTypes } from "@/lib/queries"
import type { Permission } from "@/lib/types"

type Open = null | "order" | "customer" | "expense"

// QuickTiles are the home's quick actions, as the prototype's row of
// tiles: Buyurtma, Sotuv, Xarid, Xarajat and Mijoz, those the member may
// use (logic/roles.md, section 8; what goes into a location wants one). An
// order, an expense and a customer are entered right on the home; a sale
// and a purchase are a page each. Whatever is entered shows on the home at
// once: the dashboard is asked again as a dialog closes.
export function QuickTiles({ companyId, locationId, permissions }: { companyId: number; locationId: number | null; permissions: Permission[] }) {
  const can = (permission: Permission) => permissions.includes(permission)
  const queryClient = useQueryClient()
  const [open, setOpen] = useState<Open>(null)
  const located = locationId !== null
  const tiles = [
    can("orders.create") && can("customers.view") && located && <Tile key="order" icon={ClipboardPlusIcon} label="Buyurtma" onClick={() => setOpen("order")} />,
    can("sales.create") && located && <Tile key="sale" icon={ShoppingCartIcon} label="Sotuv" href="/sales/new" />,
    can("purchases.create") && can("suppliers.view") && located && <Tile key="purchase" icon={PackagePlusIcon} label="Xarid" href="/purchases/new" />,
    can("finance.create") && <Tile key="expense" icon={ArrowDownLeftIcon} label="Xarajat" onClick={() => setOpen("expense")} />,
    can("customers.create") && <Tile key="customer" icon={UserPlusIcon} label="Mijoz" onClick={() => setOpen("customer")} />,
  ].filter(Boolean)
  if (tiles.length === 0) return null
  const close = () => {
    setOpen(null)
    queryClient.invalidateQueries({ queryKey: dashboardKey(companyId) })
  }

  return (
    <>
      <Tiles label="Tezkor amallar" className="mb-6">
        {tiles}
      </Tiles>
      {open === "order" && locationId !== null && (
        <NewOrder companyId={companyId} locationId={locationId} canCreateCustomer={can("customers.create")} onClose={close} />
      )}
      {open === "customer" && <HomeAddCustomer companyId={companyId} onClose={close} />}
      {open === "expense" && (
        <ExpenseDialog companyId={companyId} kind="expense" settingsAllowed={can("settings.view")} open onOpenChange={(next) => !next && close()} />
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
