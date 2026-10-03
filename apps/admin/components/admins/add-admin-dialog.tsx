"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { UserPlusIcon } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"
import { PendingButton } from "@/components/pending-button"
import { TextField } from "@/components/text-field"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { FieldError, FieldGroup } from "@/components/ui/field"
import { api, call } from "@/lib/api"
import { keys } from "@/lib/queries"
import { adminSchema } from "@/lib/schemas"

type Input = z.input<typeof adminSchema>
type Output = z.output<typeof adminSchema>

const empty: Input = { telegram_id: "", full_name: "" }

// AddAdminDialog adds an admin by Telegram ID, or brings a deactivated one
// back.
export function AddAdminDialog() {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const form = useForm<Input, unknown, Output>({ resolver: zodResolver(adminSchema), defaultValues: empty })
  const add = useMutation({
    mutationFn: (admin: Output) => call(api.POST("/admin/admins", { body: admin })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.admins })
      toast.success("Admin qo'shildi")
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
      <DialogTrigger render={<Button />}>
        <UserPlusIcon />
        Admin qo&apos;shish
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Admin qo&apos;shish</DialogTitle>
          <DialogDescription>
            Telegram ID admin botda ko&apos;rinadi: ruxsati yo&apos;q odam botga yozsa, bot unga ID&apos;sini aytadi.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((admin) => add.mutate(admin))} noValidate className="space-y-4">
          <FieldGroup>
            <TextField control={form.control} name="telegram_id" label="Telegram ID" inputMode="numeric" autoComplete="off" />
            <TextField control={form.control} name="full_name" label="Ism" autoComplete="off" />
          </FieldGroup>
          {add.isError && <FieldError>{add.error.message}</FieldError>}
          <DialogFooter>
            <PendingButton type="submit" pending={add.isPending}>
              Qo&apos;shish
            </PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
