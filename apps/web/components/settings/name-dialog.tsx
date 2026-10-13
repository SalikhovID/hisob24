"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { type ReactElement, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"
import { ActionTooltip } from "@/components/action-tooltip"
import { TextRow } from "@/components/kit/form-row"
import { Group } from "@/components/kit/group"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import { nameSchema } from "@/lib/schemas"

type Input = z.input<typeof nameSchema>
type Output = z.output<typeof nameSchema>

// NameDialog asks for one name and hands it on: it adds a customer type, a
// dropdown or an option, or gives one of them another name. What to do with
// the name is the caller's (onSubmit); a refusal shows the API's reason in
// the dialog, which stays open. As the prototype's sheet: the name a row,
// the main button under it.
export function NameDialog({
  title,
  description,
  initial = "",
  submit,
  done,
  trigger,
  tooltip,
  placeholder,
  open: openGiven,
  onOpenChange,
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
  // button does. open, with onOpenChange, opens it from outside instead (a
  // page's plus, a row): it has no button then.
  trigger?: ReactElement
  tooltip?: string
  // placeholder is the name's example in its row.
  placeholder?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onSubmit: (name: string) => Promise<unknown>
}) {
  const [openOwn, setOpenOwn] = useState(false)
  const controlled = openGiven !== undefined
  const open = controlled ? openGiven : openOwn
  const setOpen = (next: boolean) => (controlled ? onOpenChange?.(next) : setOpenOwn(next))
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
      {controlled ? null : tooltip ? <ActionTooltip label={tooltip}>{opener}</ActionTooltip> : opener}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <SheetForm onSubmit={form.handleSubmit((values) => save.mutate(values))}>
          {save.isError && <Refusal className="mb-4">{save.error.message}</Refusal>}
          <Group>
            <TextRow control={form.control} name="name" label="Nomi" placeholder={placeholder} autoComplete="off" />
          </Group>
          <DialogFooter>
            <MainButton type="submit" pending={save.isPending}>
              {submit}
            </MainButton>
          </DialogFooter>
        </SheetForm>
      </DialogContent>
    </Dialog>
  )
}
