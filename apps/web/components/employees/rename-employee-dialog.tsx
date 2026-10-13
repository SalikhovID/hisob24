"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { PencilIcon } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"
import { ActionTooltip } from "@/components/action-tooltip"
import { TextRow } from "@/components/kit/form-row"
import { Group } from "@/components/kit/group"
import { MainButton } from "@/components/kit/main-button"
import { SheetForm } from "@/components/kit/sheet-form"
import { Refusal } from "@/components/refusal"
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
import { api, call } from "@/lib/api"
import { formatPhone } from "@/lib/phone"
import { employeesKey } from "@/lib/queries"
import { renameSchema } from "@/lib/schemas"
import type { Member } from "@/lib/types"

type Input = z.input<typeof renameSchema>
type Output = z.output<typeof renameSchema>

// RenameEmployeeDialog changes the name an employee goes by in the owner's
// company; the names they go by in other companies stay. The phone is who
// the employee is, so it is shown, not edited. As the prototype's sheet:
// the name a row, the main button under it. open, with onOpenChange, opens
// it from outside (the employee's sheet): it has no button then.
export function RenameEmployeeDialog({
  companyId,
  employee,
  open: openGiven,
  onOpenChange,
}: {
  companyId: number
  employee: Member
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [openOwn, setOpenOwn] = useState(false)
  const controlled = openGiven !== undefined
  const open = controlled ? openGiven : openOwn
  const setOpen = (next: boolean) => (controlled ? onOpenChange?.(next) : setOpenOwn(next))
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
      {!controlled && (
      <ActionTooltip label="Ismni o'zgartirish">
        <DialogTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground max-md:relative max-md:size-9 max-md:after:absolute max-md:after:-inset-1 pointer-coarse:relative pointer-coarse:size-9 pointer-coarse:after:absolute pointer-coarse:after:-inset-1"
              aria-label={`Ismni o'zgartirish: ${employee.full_name ?? formatPhone(employee.phone)}`}
            />
          }
        >
          <PencilIcon />
        </DialogTrigger>
      </ActionTooltip>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ismni o&apos;zgartirish</DialogTitle>
          <DialogDescription>{formatPhone(employee.phone)}</DialogDescription>
        </DialogHeader>
        <SheetForm onSubmit={form.handleSubmit((name) => rename.mutate(name))}>
          {rename.isError && <Refusal className="mb-4">{rename.error.message}</Refusal>}
          <Group>
            <TextRow control={form.control} name="full_name" label="Ism" placeholder="Ism Familiya" autoComplete="off" />
          </Group>
          <DialogFooter>
            <MainButton type="submit" pending={rename.isPending}>
              Saqlash
            </MainButton>
          </DialogFooter>
        </SheetForm>
      </DialogContent>
    </Dialog>
  )
}
