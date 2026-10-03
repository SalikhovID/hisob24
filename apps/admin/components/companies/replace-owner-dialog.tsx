"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { UserCogIcon } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"
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
import { FieldError, FieldGroup } from "@/components/ui/field"
import { api, call } from "@/lib/api"
import { keys } from "@/lib/queries"
import { ownerSchema } from "@/lib/schemas"

type Input = z.input<typeof ownerSchema>
type Output = z.output<typeof ownerSchema>

const empty: Input = { phone: "", full_name: "" }

// ReplaceOwnerDialog makes another phone the company's owner. A company has
// one owner, so the one before stays in it as an employee.
export function ReplaceOwnerDialog({ companyId }: { companyId: number }) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const form = useForm<Input, unknown, Output>({ resolver: zodResolver(ownerSchema), defaultValues: empty })
  const replace = useMutation({
    mutationFn: (owner: Output) =>
      call(api.PUT("/admin/companies/{id}/owner", { params: { path: { id: companyId } }, body: owner })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.company(companyId) })
      toast.success("Kompaniya egasi almashtirildi")
      setOpen(false)
    },
  })

  // Every opening starts from an empty form.
  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (next) {
      form.reset(empty)
      replace.reset()
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <UserCogIcon />
        Egasini almashtirish
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Egasini almashtirish</DialogTitle>
          <DialogDescription>
            Kiritilgan raqam kompaniya egasi bo&apos;ladi. Oldingi egasi xodim bo&apos;lib qoladi.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((owner) => replace.mutate(owner))} noValidate className="space-y-4">
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
          </FieldGroup>
          {replace.isError && <FieldError>{replace.error.message}</FieldError>}
          <DialogFooter>
            <Button type="submit" disabled={replace.isPending}>
              Almashtirish
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
