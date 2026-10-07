"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Trash2Icon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { ActionTooltip } from "@/components/action-tooltip"
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
import { productsKey } from "@/lib/queries"
import type { Product } from "@/lib/types"
import { iconAction, nounOf } from "./icon-action"

// DeleteProductButton deletes a product or a service after asking. A
// deleted record is not shown anywhere again, and its name (and SKU) is free
// for another. A refusal (a product a purchase holds) shows the API's reason
// and the record stays. afterDelete is what follows: a page leaves for the
// list.
export function DeleteProductButton({
  companyId,
  product,
  iconOnly = false,
  afterDelete,
}: {
  companyId: number
  product: Product
  iconOnly?: boolean
  afterDelete?: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const queryClient = useQueryClient()
  const noun = nounOf(product.kind)
  const remove = useMutation({
    mutationFn: () => call(api.DELETE("/app/products/{id}", { params: { path: { id: product.id } } })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productsKey(companyId) })
      toast.success(`${noun} o'chirildi`)
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
            render={
              <Button
                variant="ghost"
                size="icon"
                className={`${iconAction} hover:text-destructive`}
                aria-label={`O'chirish: ${product.name}`}
              />
            }
          >
            <Trash2Icon />
          </AlertDialogTrigger>
        </ActionTooltip>
      ) : (
        <AlertDialogTrigger
          render={
            <Button
              variant="outline"
              size="lg"
              className="px-3.5 hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20"
            />
          }
        >
          <Trash2Icon />
          O&apos;chirish
        </AlertDialogTrigger>
      )}
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
