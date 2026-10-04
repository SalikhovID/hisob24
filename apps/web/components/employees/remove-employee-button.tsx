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
import { formatPhone } from "@/lib/phone"
import { employeesKey } from "@/lib/queries"
import type { Member } from "@/lib/types"

// RemoveEmployeeButton takes an employee out of the owner's company, after
// asking. From their next request on they are out of it; the other
// companies they work in are theirs still. A refusal shows the API's reason.
export function RemoveEmployeeButton({
  companyId,
  companyName,
  employee,
}: {
  companyId: number
  companyName: string
  employee: Member
}) {
  const [confirming, setConfirming] = useState(false)
  const queryClient = useQueryClient()
  const name = employee.full_name ?? formatPhone(employee.phone)
  const remove = useMutation({
    mutationFn: () => call(api.DELETE("/app/employees/{phone}", { params: { path: { phone: employee.phone } } })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeesKey(companyId) })
      toast.success("Xodim o'chirildi")
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
          <AlertDialogTitle>Xodimni o&apos;chirasizmi?</AlertDialogTitle>
          <AlertDialogDescription>
            {name} {companyName} kompaniyasiga kira olmaydi. Keyin qayta qo&apos;shish mumkin.
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
