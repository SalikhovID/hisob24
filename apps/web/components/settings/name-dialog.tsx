"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { type ReactElement, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"
import { ActionTooltip } from "@/components/action-tooltip"
import { PendingButton } from "@/components/pending-button"
import { Refusal } from "@/components/refusal"
import { TextField } from "@/components/text-field"
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
import { nameSchema } from "@/lib/schemas"

type Input = z.input<typeof nameSchema>
type Output = z.output<typeof nameSchema>

// NameDialog asks for one name and hands it on: it adds a customer type, a
// dropdown or an option, or gives one of them another name. What to do with
// the name is the caller's (onSubmit); a refusal shows the API's reason in
// the dialog, which stays open.
export function NameDialog({
  title,
  description,
  initial = "",
  submit,
  done,
  trigger,
  tooltip,
  onSubmit,
}: {
  title: string
  description: string
  // initial is the name as it is now, when one is being changed.
  initial?: string
  // submit names the dialog's button; done is what the toast says after.
  submit: string
  done: string
  // trigger is the button that opens the dialog; tooltip says what an icon
  // button does.
  trigger: ReactElement
  tooltip?: string
  onSubmit: (name: string) => Promise<unknown>
}) {
  const [open, setOpen] = useState(false)
  const form = useForm<Input, unknown, Output>({ resolver: zodResolver(nameSchema), defaultValues: { name: initial } })
  const save = useMutation({
    mutationFn: ({ name }: Output) => onSubmit(name),
    onSuccess: () => {
      toast.success(done)
      setOpen(false)
    },
  })

  // Every opening starts from the name as it is now.
  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (next) {
      form.reset({ name: initial })
      save.reset()
    }
  }

  const opener = <DialogTrigger render={trigger} />
  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      {tooltip ? <ActionTooltip label={tooltip}>{opener}</ActionTooltip> : opener}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((values) => save.mutate(values))} noValidate className="space-y-4">
          <FieldGroup>
            <TextField control={form.control} name="name" label="Nomi" autoComplete="off" />
          </FieldGroup>
          {save.isError && <Refusal>{save.error.message}</Refusal>}
          <DialogFooter>
            <PendingButton type="submit" size="lg" className="px-3.5 max-sm:h-10" pending={save.isPending}>
              {submit}
            </PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
