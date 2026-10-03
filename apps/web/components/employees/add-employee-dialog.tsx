"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { UserPlusIcon } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"
import { PendingButton } from "@/components/pending-button"
import { PhoneField } from "@/components/phone-field"
import { Refusal } from "@/components/refusal"
import { TextField } from "@/components/text-field"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { FieldGroup } from "@/components/ui/field"
import { api, call } from "@/lib/api"
import { employeesKey } from "@/lib/queries"
import { employeeSchema } from "@/lib/schemas"

type Input = z.input<typeof employeeSchema>
type Output = z.output<typeof employeeSchema>

const empty: Input = { phone: "", full_name: "" }

// AddEmployeeDialog adds a phone to the owner's company as an employee,
// under the name the owner gives. A phone that works in another company is
// added the same way and from then on is in both; one that is in this
// company already is refused, and the API's reason shows in the dialog.
export function AddEmployeeDialog({ companyId }: { companyId: number }) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const form = useForm<Input, unknown, Output>({ resolver: zodResolver(employeeSchema), defaultValues: empty })
  const add = useMutation({
    mutationFn: (employee: Output) => call(api.POST("/app/employees", { body: employee })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeesKey(companyId) })
      toast.success("Xodim qo'shildi")
      setOpen(false)
    },
  })

  // Every opening starts from an empty form.
  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (next) {
      form.reset(empty)
      add.reset()
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger render={<Button size="lg" className="px-3.5" />}>
        <UserPlusIcon />
        Xodim qo&apos;shish
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Xodim qo&apos;shish</DialogTitle>
          <DialogDescription>
            Xodim shu raqam bilan tizimga kiradi: SMS kod yoki Telegram bot orqali.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((employee) => add.mutate(employee))} noValidate className="space-y-4">
          <FieldGroup>
            <PhoneField control={form.control} name="phone" label="Telefon raqami" autoComplete="off" />
            <TextField control={form.control} name="full_name" label="Ism" autoComplete="off" />
          </FieldGroup>
          {add.isError && <Refusal>{add.error.message}</Refusal>}
          <DialogFooter>
            <PendingButton type="submit" size="lg" className="max-sm:h-10" pending={add.isPending}>
              Qo&apos;shish
            </PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
