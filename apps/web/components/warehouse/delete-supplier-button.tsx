"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Trash2Icon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { ActionTooltip } from "@/components/action-tooltip"
import { iconAction } from "@/components/catalog/icon-action"
import { PendingButton } from "@/components/pending-button"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { api, call } from "@/lib/api"
import { suppliersKey } from "@/lib/queries"
import type { Supplier } from "@/lib/types"

// DeleteSupplierButton deletes a supplier after asking. One with live
// purchases or payments is kept: the API's reason is told and the record
// stays (it may be turned off instead). afterDelete is what follows: a page
// leaves for the list.
export function DeleteSupplierButton({
  companyId,
  supplier,
  iconOnly = false,
  afterDelete,
}: {
  companyId: number
  supplier: Supplier
  iconOnly?: boolean
  afterDelete?: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const queryClient = useQueryClient()
  const remove = useMutation({
    mutationFn: () => call(api.DELETE("/app/suppliers/{id}", { params: { path: { id: supplier.id } } })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: suppliersKey(companyId) })
      toast.success("Ta'minotchi o'chirildi")
      setConfirming(false)
      afterDelete?.()
    },
    onError: (error) => {
      toast.error(error.message)
      setConfirming(false)
    },
  })

  return (
    <AlertDialog open={confirming} onOpenChange={setConfirming}>
      {iconOnly ? (
        <ActionTooltip label="O'chirish">
          <AlertDialogTrigger
            render={<Button variant="ghost" size="icon" className={`${iconAction} hover:text-destructive`} aria-label={`O'chirish: ${supplier.name}`} />}
          >
            <Trash2Icon />
          </AlertDialogTrigger>
        </ActionTooltip>
      ) : (
        <AlertDialogTrigger
          render={<Button variant="outline" size="lg" className="px-3.5 hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20" />}
        >
          <Trash2Icon />
          O&apos;chirish
        </AlertDialogTrigger>
      )}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Ta&apos;minotchini o&apos;chirasizmi?</AlertDialogTitle>
          <AlertDialogDescription>{supplier.name} ro&apos;yxatdan olib tashlanadi. Qayta tiklab bo&apos;lmaydi.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel size="lg" className="max-sm:h-10">
            Bekor qilish
          </AlertDialogCancel>
          <PendingButton
            variant="destructive"
            size="lg"
            className="max-sm:h-10"
            pending={remove.isPending || (remove.isSuccess && afterDelete !== undefined)}
            onClick={() => remove.mutate()}
          >
            O&apos;chirish
          </PendingButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
