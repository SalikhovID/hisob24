"use client"

import { useMutation } from "@tanstack/react-query"
import { Trash2Icon } from "lucide-react"
import { type ReactNode, useState } from "react"
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
import { iconDanger } from "./setting-row"

// DeleteButton deletes something of the settings after asking: a customer
// type, a field, a dropdown or an option. What deleting does is the caller's
// (onDelete). The API refuses what is in use: its reason then shows as a
// toast, and nothing is deleted.
export function DeleteButton({
  label,
  title,
  description,
  done,
  onDelete,
  open,
  onOpenChange,
  onDone,
}: {
  // label names the button for assistive technology: "O'chirish: Yuridik".
  label: string
  // title asks, description says what goes and what would stop it.
  title: string
  description: ReactNode
  // done is what the toast says after.
  done: string
  onDelete: () => Promise<unknown>
  // open, with onOpenChange, opens the question from outside (a danger
  // row): it has no button then. onDone goes on after a deletion (back to
  // the list the deleted one was in).
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onDone?: () => void
}) {
  const [confirmingOwn, setConfirmingOwn] = useState(false)
  const controlled = open !== undefined
  const confirming = controlled ? open : confirmingOwn
  const setConfirming = (next: boolean) => (controlled ? onOpenChange?.(next) : setConfirmingOwn(next))
  const remove = useMutation({
    mutationFn: onDelete,
    onSuccess: () => {
      toast.success(done)
      onDone?.()
    },
    onError: (error) => toast.error(error.message),
    onSettled: () => setConfirming(false),
  })

  return (
    <AlertDialog open={confirming} onOpenChange={setConfirming}>
      {!controlled && (
        <ActionTooltip label="O'chirish">
          <AlertDialogTrigger render={<Button variant="ghost" size="icon" className={iconDanger} aria-label={label} />}>
            <Trash2Icon />
          </AlertDialogTrigger>
        </ActionTooltip>
      )}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel size="lg" className="max-sm:h-10">
            Bekor qilish
          </AlertDialogCancel>
          <PendingButton
            variant="destructive"
            size="lg"
            className="max-sm:h-10"
            pending={remove.isPending}
            onClick={() => remove.mutate()}
          >
            O&apos;chirish
          </PendingButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
