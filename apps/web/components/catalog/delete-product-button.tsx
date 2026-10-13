"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"
import { Group, Row } from "@/components/kit/group"
import { PendingButton } from "@/components/pending-button"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { api, call } from "@/lib/api"
import { nounOf } from "@/lib/catalog"
import { productsKey } from "@/lib/queries"
import type { Product } from "@/lib/types"

// DeleteProductButton is the danger row at the foot of a product's (or a
// service's) page: it deletes the record after asking. afterDelete is what
// follows: the page leaves for the list.
export function DeleteProductButton({ companyId, product, afterDelete }: { companyId: number; product: Product; afterDelete?: () => void }) {
  const [confirming, setConfirming] = useState(false)
  return (
    <>
      <Group>
        <Row variant="danger" onClick={() => setConfirming(true)} title={`${nounOf(product.kind)}ni o'chirish`} />
      </Group>
      <DeleteProductDialog companyId={companyId} product={product} open={confirming} onOpenChange={setConfirming} afterDelete={afterDelete} />
    </>
  )
}

// DeleteProductDialog asks whether to delete a product or a service, and
// does. It opens from outside: the danger row of a page, «O'chirish» in a
// service's sheet of actions in the list. A deleted record is not shown
// anywhere again, and its name (and SKU) is free for another. A refusal (a
// product a purchase holds) shows the API's reason, and the record stays.
export function DeleteProductDialog({
  companyId,
  product,
  open,
  onOpenChange,
  afterDelete,
}: {
  companyId: number
  product: Product
  open: boolean
  onOpenChange: (open: boolean) => void
  afterDelete?: () => void
}) {
  const queryClient = useQueryClient()
  const noun = nounOf(product.kind)
  const remove = useMutation({
    mutationFn: () => call(api.DELETE("/app/products/{id}", { params: { path: { id: product.id } } })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productsKey(companyId) })
      toast.success(`${noun} o'chirildi`)
      onOpenChange(false)
      afterDelete?.()
    },
    onError: (error) => {
      toast.error(error.message)
      onOpenChange(false)
    },
  })

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{noun}ni o&apos;chirasizmi?</AlertDialogTitle>
          <AlertDialogDescription>{product.name} ro&apos;yxatdan olib tashlanadi. Qayta tiklab bo&apos;lmaydi.</AlertDialogDescription>
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
