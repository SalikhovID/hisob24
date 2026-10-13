"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Radio } from "@base-ui/react/radio"
import { RadioGroup } from "@base-ui/react/radio-group"
import { useMutation } from "@tanstack/react-query"
import { type ReactElement, useId, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"
import { ActionTooltip } from "@/components/action-tooltip"
import { FormRow, SwitchRow, TextRow } from "@/components/kit/form-row"
import { Foot, Group, Row } from "@/components/kit/group"
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
import { stageSchema } from "@/lib/schemas"
import { colorClasses, colorLabels, stageColors } from "@/lib/stage-colors"
import { cn } from "@/lib/utils"

type Input = z.input<typeof stageSchema>
export type StageOutput = z.output<typeof stageSchema>

const empty: Input = { name: "", color: "", is_done: false }

// StageDialog asks what a stage is: its name, its color (a swatch) and
// whether it is the final one, and hands it on: it adds a stage, or changes
// one. What to do with it is the caller's (onSubmit); a refusal shows the
// API's reason in the dialog, which stays open. As the prototype's sheet:
// the name a row, the colors as swatches with the chosen one named, the
// final mark a switch with what it means, and, for a stage being changed,
// the way to delete it.
export function StageDialog({
  title,
  description,
  initial = empty,
  submit,
  done,
  trigger,
  tooltip,
  open: openGiven,
  onOpenChange,
  onDelete,
  onSubmit,
}: {
  title: string
  description: string
  // initial is the stage as it is now, when one is being changed.
  initial?: Input
  // submit names the dialog's button; done is what the toast says after.
  submit: string
  done: string
  // trigger is the button that opens the dialog; tooltip says what an icon
  // button does.
  trigger?: ReactElement
  tooltip?: string
  // open, with onOpenChange, opens it from outside instead (a page's plus,
  // a row): it has no button then.
  open?: boolean
  onOpenChange?: (open: boolean) => void
  // onDelete, for a stage being changed, is the danger row's: the caller asks and deletes.
  onDelete?: () => void
  onSubmit: (stage: StageOutput) => Promise<unknown>
}) {
  const [openOwn, setOpenOwn] = useState(false)
  const controlled = openGiven !== undefined
  const open = controlled ? openGiven : openOwn
  const setOpen = (next: boolean) => (controlled ? onOpenChange?.(next) : setOpenOwn(next))
  const id = useId()
  const form = useForm<Input, unknown, StageOutput>({ resolver: zodResolver(stageSchema), defaultValues: initial })
  const save = useMutation({
    mutationFn: onSubmit,
    onSuccess: () => {
      toast.success(done)
      setOpen(false)
    },
  })

  // Every opening starts from the stage as it is now.
  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (next) {
      form.reset(initial)
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
        <SheetForm onSubmit={form.handleSubmit((stage) => save.mutate(stage))}>
          {save.isError && <Refusal className="mb-4">{save.error.message}</Refusal>}
          <Group>
            <TextRow control={form.control} name="name" label="Nomi" placeholder="Masalan, Jarayonda" autoComplete="off" />
            <Controller
              control={form.control}
              name="color"
              render={({ field, fieldState }) => {
                const chosen = stageColors.find((color) => color === field.value)
                return (
                  <FormRow stack label={`Rangi${chosen ? ` · ${colorLabels[chosen]}` : ""}`} error={fieldState.error?.message} errorId={`${id}-color-error`}>
                    {/* A swatch for each color, named by the color's name. */}
                    <RadioGroup
                      aria-label="Rangi"
                      aria-describedby={fieldState.error ? `${id}-color-error` : undefined}
                      value={field.value}
                      onValueChange={(value) => field.onChange(String(value))}
                      className="flex flex-wrap gap-3"
                    >
                      {stageColors.map((color) => (
                        <Radio.Root
                          key={color}
                          value={color}
                          aria-label={colorLabels[color]}
                          className={cn(
                            "size-9 rounded-full ring-offset-2 ring-offset-card outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:ring-[2.5px] data-checked:ring-foreground",
                            colorClasses[color].dot,
                          )}
                        />
                      ))}
                    </RadioGroup>
                  </FormRow>
                )
              }}
            />
          </Group>
          <Group>
            <SwitchRow control={form.control} name="is_done" label="Yakuniy bosqich" />
          </Group>
          <Foot className="-mt-4">Bu bosqichdagi vazifa bajarilgan hisoblanadi: muddati o&apos;tgan deb belgilanmaydi.</Foot>
          {onDelete && (
            <Group>
              <Row variant="danger" onClick={onDelete} title="Bosqichni o'chirish" />
            </Group>
          )}
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
