"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"
import { PhoneRow, TextRow } from "@/components/kit/form-row"
import { Foot, Group } from "@/components/kit/group"
import { MainButton } from "@/components/kit/main-button"
import { SheetForm } from "@/components/kit/sheet-form"
import { Refusal } from "@/components/refusal"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { api, call } from "@/lib/api"
import { employeesKey } from "@/lib/queries"
import { employeeSchema } from "@/lib/schemas"

type Input = z.input<typeof employeeSchema>
type Output = z.output<typeof employeeSchema>

const empty: Input = { phone: "", full_name: "" }

// AddEmployeeDialog adds a phone to the owner's company as an employee,
// under the name the owner gives. A phone that works in another company is
// added the same way and from then on is in both; one that is in this
// company already is refused, and the API's reason shows in the dialog. As
// the prototype's sheet: the phone and the name rows, what a new employee
// may do said under them. It is opened from outside (the page's plus).
export function AddEmployeeDialog({
  companyId,
  open,
  onOpenChange,
}: {
  companyId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const form = useForm<Input, unknown, Output>({ resolver: zodResolver(employeeSchema), defaultValues: empty })
  const add = useMutation({
    mutationFn: (employee: Output) => call(api.POST("/app/employees", { body: employee })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeesKey(companyId) })
      toast.success("Xodim qo'shildi")
      onOpenChange(false)
    },
  })


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Xodim qo&apos;shish</DialogTitle>
          <DialogDescription>
            Xodim shu raqam bilan tizimga kiradi: SMS kod yoki Telegram bot orqali.
          </DialogDescription>
        </DialogHeader>
        <SheetForm onSubmit={form.handleSubmit((employee) => add.mutate(employee))}>
          {add.isError && <Refusal className="mb-4">{add.error.message}</Refusal>}
          <Group>
            <PhoneRow control={form.control} name="phone" />
            <TextRow control={form.control} name="full_name" label="Ism" placeholder="Ism Familiya" autoComplete="off" />
          </Group>
          <Foot className="-mt-4">Yangi xodim rolsiz va hamma lokatsiyada ishlaydi. Keyin o&apos;zgartirish mumkin.</Foot>
          <DialogFooter>
            <MainButton type="submit" pending={add.isPending}>
              Qo&apos;shish
            </MainButton>
          </DialogFooter>
        </SheetForm>
      </DialogContent>
    </Dialog>
  )
}
