"use client"

import { useMutation } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { toast } from "sonner"
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

// DeleteDialog asks whether to delete something of the settings, and does:
// a customer type, a field, a stage, a dropdown, an option, a category or a
// role, from its page's danger row or its sheet. What deleting does is the
// caller's (onDelete); onDone goes on after a deletion (back to the list
// the deleted one was in). The API refuses what is in use: its reason then
// shows as a toast, and nothing is deleted.
export function DeleteDialog({
  title,
  description,
  done,
  onDelete,
  open,
  onOpenChange,
  onDone,
}: {
  // title asks, description says what goes and what would stop it.
  title: string
  description: ReactNode
  // done is what the toast says after.
  done: string
  onDelete: () => Promise<unknown>
  open: boolean
  onOpenChange: (open: boolean) => void
  onDone?: () => void
}) {
  const remove = useMutation({
    mutationFn: onDelete,
    onSuccess: () => {
      toast.success(done)
      onDone?.()
    },
    onError: (error) => toast.error(error.message),
    onSettled: () => onOpenChange(false),
  })

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
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
