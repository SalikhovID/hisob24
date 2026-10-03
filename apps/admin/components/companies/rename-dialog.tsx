"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { PencilIcon } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"
import { PendingButton } from "@/components/pending-button"
import { Refusal } from "@/components/refusal"
import { TextField } from "@/components/text-field"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { companySchema } from "@/lib/schemas"
import type { Company } from "@/lib/types"
import { useUpdateCompany } from "./company-actions"

const renameSchema = companySchema.pick({ name: true })

// RenameDialog changes a company's name.
export function RenameDialog({ company }: { company: Company }) {
  const [open, setOpen] = useState(false)
  const update = useUpdateCompany(company.id)
  const form = useForm<z.input<typeof renameSchema>, unknown, z.output<typeof renameSchema>>({
    resolver: zodResolver(renameSchema),
    defaultValues: { name: company.name },
  })

  // Every opening starts from the current name.
  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (next) {
      form.reset({ name: company.name })
      update.reset()
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger render={<Button variant="outline" size="lg" />}>
        <PencilIcon />
        Nomini o&apos;zgartirish
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nomini o&apos;zgartirish</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(({ name }) =>
            update.mutate(
              { name },
              {
                onSuccess: () => {
                  setOpen(false)
                  toast.success("Nomi o'zgartirildi")
                },
              },
            ),
          )}
          noValidate
          className="space-y-4"
        >
          <TextField control={form.control} name="name" label="Kompaniya nomi" autoComplete="off" />
          {update.isError && <Refusal>{update.error.message}</Refusal>}
          <DialogFooter>
            <PendingButton type="submit" size="lg" className="max-sm:h-10" pending={update.isPending}>
              Saqlash
            </PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
