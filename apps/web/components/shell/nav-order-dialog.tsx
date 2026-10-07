"use client"

import { useState } from "react"
import { toast } from "sonner"
import { PendingButton } from "@/components/pending-button"
import { Refusal } from "@/components/refusal"
import { SortableList } from "@/components/sortable-list"
import { ListLoading } from "@/components/states"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { type NavKey, navFor } from "@/lib/nav"
import { useMe, useSetNavOrder } from "@/lib/queries"
import type { Me } from "@/lib/types"

// NavOrderDialog is where a member puts the sections of the menu in their
// own order (logic/roles.md, section 8): the sidebar and the tab bar follow
// it, on a phone the first four stand in the bar and the rest under «Yana».
// The order is the membership's: the same on every device, in this company.
// It is opened from «Yana» and from the profile menu.
export function NavOrderDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const me = useMe()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Menyuni sozlash</DialogTitle>
          <DialogDescription>
            Bo&apos;limlar sidebar va pastki panelda shu tartibda turadi; telefonda birinchi to&apos;rttasi panelda, qolgani
            «Yana»da.
          </DialogDescription>
        </DialogHeader>
        {me.data ? <OrderForm me={me.data} onDone={() => onOpenChange(false)} /> : <ListLoading rows={3} mark="none" />}
      </DialogContent>
    </Dialog>
  )
}

// OrderForm is the list in its order and the two buttons. It lives inside
// the open dialog and starts from the session as it is known, so every
// opening starts from the order as it is now.
function OrderForm({ me, onDone }: { me: Me; onDone: () => void }) {
  // null is the default order.
  const [order, setOrder] = useState<NavKey[] | null>(me.nav_order ?? null)
  const items = navFor(me.permissions, order)
  const save = useSetNavOrder()

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        save.mutate(order, {
          onSuccess: () => {
            toast.success("Menyu tartibi saqlandi")
            onDone()
          },
        })
      }}
      noValidate
      className="space-y-4"
    >
      <SortableList
        label="Bo'limlar tartibi"
        items={items}
        getId={(item) => item.key}
        getLabel={(item) => item.label}
        onReorder={(ids) => setOrder(ids as NavKey[])}
        className="divide-y rounded-lg border"
        renderItem={(item, handle) => {
          const Icon = item.icon
          return (
            <div className="flex items-center gap-2 px-2 py-1.5">
              {handle}
              <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm font-medium">{item.label}</span>
            </div>
          )
        }}
      />
      {save.isError && <Refusal>{save.error.message}</Refusal>}
      <DialogFooter className="sm:justify-between">
        <Button type="button" variant="outline" size="lg" className="px-3.5 max-sm:h-10" disabled={order === null} onClick={() => setOrder(null)}>
          Standart holat
        </Button>
        <PendingButton type="submit" size="lg" className="px-3.5 max-sm:h-10" pending={save.isPending}>
          Saqlash
        </PendingButton>
      </DialogFooter>
    </form>
  )
}
