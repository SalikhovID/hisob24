"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
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
import { api, call } from "@/lib/api"
import { formatPhone } from "@/lib/phone"
import { employeesKey } from "@/lib/queries"
import type { Member } from "@/lib/types"

// RemoveEmployeeDialog asks whether to take an employee out of the owner's
// company, and does: the employee's sheet opens it from its danger row.
// From their next request on they are out of it; the other companies they
// work in are theirs still. A refusal shows the API's reason.
export function RemoveEmployeeDialog({
  companyId,
  companyName,
  employee,
  open,
  onOpenChange,
}: {
  companyId: number
  companyName: string
  employee: Member
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const name = employee.full_name ?? formatPhone(employee.phone)
  const remove = useMutation({
    mutationFn: () => call(api.DELETE("/app/employees/{phone}", { params: { path: { phone: employee.phone } } })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeesKey(companyId) })
      toast.success("Xodim o'chirildi")
    },
    onError: (error) => toast.error(error.message),
    onSettled: () => onOpenChange(false),
  })

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
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
