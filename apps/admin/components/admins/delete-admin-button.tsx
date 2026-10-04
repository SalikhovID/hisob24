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
import { keys } from "@/lib/queries"
import type { AdminAccount } from "@/lib/types"

// DeleteAdminButton turns an admin off after asking: the row stays, the
// admin's sessions end. A refusal (the last admin) shows the API's reason.
export function DeleteAdminButton({ admin }: { admin: AdminAccount }) {
  const [confirming, setConfirming] = useState(false)
  const queryClient = useQueryClient()
  // An admin with no name goes by the ID, as in the list.
  const name = admin.full_name ?? `Telegram ID ${admin.telegram_id}`
  const remove = useMutation({
    mutationFn: () =>
      call(api.DELETE("/admin/admins/{telegram_id}", { params: { path: { telegram_id: admin.telegram_id } } })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.admins })
      toast.success("Admin o'chirildi")
    },
    onError: (error) => toast.error(error.message),
    onSettled: () => setConfirming(false),
  })

  return (
    <AlertDialog open={confirming} onOpenChange={setConfirming}>
      <ActionTooltip label="O'chirish">
        <AlertDialogTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20 max-md:relative max-md:size-9 max-md:after:absolute max-md:after:-inset-1 pointer-coarse:relative pointer-coarse:size-9 pointer-coarse:after:absolute pointer-coarse:after:-inset-1"
              aria-label={`O'chirish: ${name}`}
            />
          }
        >
          <Trash2Icon />
        </AlertDialogTrigger>
      </ActionTooltip>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Adminni o&apos;chirasizmi?</AlertDialogTitle>
          <AlertDialogDescription>
            {name} panelga kira olmaydi va uning barcha sessiyalari tugaydi. Keyin qayta qo&apos;shish mumkin.
          </AlertDialogDescription>
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
