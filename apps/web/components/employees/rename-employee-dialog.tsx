"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { PencilIcon } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"
import { ActionTooltip } from "@/components/action-tooltip"
import { PendingButton } from "@/components/pending-button"
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
import { formatPhone } from "@/lib/phone"
import { employeesKey } from "@/lib/queries"
import { renameSchema } from "@/lib/schemas"
import type { Member } from "@/lib/types"

type Input = z.input<typeof renameSchema>
type Output = z.output<typeof renameSchema>

// RenameEmployeeDialog changes the name an employee goes by in the owner's
// company; the names they go by in other companies stay. The phone is who
// the employee is, so it is shown, not edited.
export function RenameEmployeeDialog({ companyId, employee }: { companyId: number; employee: Member }) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const current: Input = { full_name: employee.full_name ?? "" }
  const form = useForm<Input, unknown, Output>({ resolver: zodResolver(renameSchema), defaultValues: current })
  const rename = useMutation({
    mutationFn: (name: Output) =>
      call(api.PATCH("/app/employees/{phone}", { params: { path: { phone: employee.phone } }, body: name })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeesKey(companyId) })
      toast.success("Ism o'zgartirildi")
      setOpen(false)
    },
  })

  // Every opening starts from the name as it is now.
  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (next) {
      form.reset(current)
      rename.reset()
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <ActionTooltip label="Ismni o'zgartirish">
        <DialogTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground max-md:relative max-md:size-9 max-md:after:absolute max-md:after:-inset-1"
              aria-label={`Ismni o'zgartirish: ${employee.full_name ?? formatPhone(employee.phone)}`}
            />
          }
        >
          <PencilIcon />
        </DialogTrigger>
      </ActionTooltip>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ismni o&apos;zgartirish</DialogTitle>
          <DialogDescription>{formatPhone(employee.phone)}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((name) => rename.mutate(name))} noValidate className="space-y-4">
          <FieldGroup>
            <TextField control={form.control} name="full_name" label="Ism" autoComplete="off" />
          </FieldGroup>
          {rename.isError && <Refusal>{rename.error.message}</Refusal>}
          <DialogFooter>
            <PendingButton type="submit" size="lg" className="max-sm:h-10" pending={rename.isPending}>
              Saqlash
            </PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
