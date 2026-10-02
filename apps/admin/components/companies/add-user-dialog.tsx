"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { UserPlusIcon } from "lucide-react"
import { useId, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"
import { TextField } from "@/components/text-field"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { api, call } from "@/lib/api"
import { keys } from "@/lib/queries"
import { roleLabels } from "@/lib/roles"
import { memberSchema } from "@/lib/schemas"

type Input = z.input<typeof memberSchema>
type Output = z.output<typeof memberSchema>

const empty: Input = { phone: "", full_name: "", role: "staff" }

// AddUserDialog adds a user to a company, or gives a member a new role.
export function AddUserDialog({ companyId }: { companyId: number }) {
  const [open, setOpen] = useState(false)
  const roleId = useId()
  const queryClient = useQueryClient()
  const form = useForm<Input, unknown, Output>({ resolver: zodResolver(memberSchema), defaultValues: empty })
  const add = useMutation({
    mutationFn: (member: Output) =>
      call(api.POST("/admin/companies/{id}/users", { params: { path: { id: companyId } }, body: member })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.company(companyId) })
      toast.success("User qo'shildi")
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
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <UserPlusIcon />
        User qo&apos;shish
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>User qo&apos;shish</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((member) => add.mutate(member))} noValidate className="space-y-4">
          <FieldGroup>
            <TextField
              control={form.control}
              name="phone"
              label="Telefon"
              type="tel"
              inputMode="tel"
              placeholder="+998 90 123 45 67"
            />
            <TextField control={form.control} name="full_name" label="Ism" autoComplete="off" />
            <Controller
              control={form.control}
              name="role"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor={roleId}>Rol</FieldLabel>
                  <NativeSelect id={roleId} {...field}>
                    {Object.entries(roleLabels).map(([value, label]) => (
                      <NativeSelectOption key={value} value={value}>
                        {label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
          </FieldGroup>
          {add.isError && <FieldError>{add.error.message}</FieldError>}
          <DialogFooter>
            <Button type="submit" disabled={add.isPending}>
              Qo&apos;shish
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
