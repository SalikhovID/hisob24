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
import { CheckboxField } from "@/components/checkbox-field"
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
import { Field, FieldError, FieldGroup, FieldTitle } from "@/components/ui/field"
import { stageSchema } from "@/lib/schemas"
import { colorClasses, colorLabels, stageColors } from "@/lib/stage-colors"
import { cn } from "@/lib/utils"

type Input = z.input<typeof stageSchema>
export type StageOutput = z.output<typeof stageSchema>

const empty: Input = { name: "", color: "", is_done: false }

// StageDialog asks what a stage is: its name, its color (a swatch) and
// whether it is the final one, and hands it on: it adds a stage, or changes
// one. What to do with it is the caller's (onSubmit); a refusal shows the
// API's reason in the dialog, which stays open.
export function StageDialog({
  title,
  description,
  initial = empty,
  submit,
  done,
  trigger,
  tooltip,
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
  trigger: ReactElement
  tooltip?: string
  onSubmit: (stage: StageOutput) => Promise<unknown>
}) {
  const [open, setOpen] = useState(false)
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
      {tooltip ? <ActionTooltip label={tooltip}>{opener}</ActionTooltip> : opener}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((stage) => save.mutate(stage))} noValidate className="space-y-4">
          <FieldGroup>
            <TextField control={form.control} name="name" label="Nomi" autoComplete="off" />
            <Controller
              control={form.control}
              name="color"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldTitle id={`${id}-color`}>Rangi</FieldTitle>
                  {/* A swatch for each color, named by the color's name. */}
                  <RadioGroup
                    aria-labelledby={`${id}-color`}
                    value={field.value}
                    onValueChange={(value) => field.onChange(String(value))}
                    className="flex flex-wrap gap-2.5"
                  >
                    {stageColors.map((color) => (
                      <Radio.Root
                        key={color}
                        value={color}
                        aria-label={colorLabels[color]}
                        className={cn(
                          "size-8 rounded-full ring-offset-2 ring-offset-card outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:ring-2 data-checked:ring-foreground",
                          colorClasses[color].dot,
                        )}
                      />
                    ))}
                  </RadioGroup>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <div className="space-y-1">
              <CheckboxField control={form.control} name="is_done" label="Yakuniy bosqich" />
              <p className="text-[0.8125rem] leading-5 text-pretty text-muted-foreground">
                Bu bosqichdagi vazifa bajarilgan hisoblanadi: muddati o&apos;tgan deb belgilanmaydi.
              </p>
            </div>
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
