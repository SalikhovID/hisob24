"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { PencilIcon, PlusIcon } from "lucide-react"
import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"
import { ActionTooltip } from "@/components/action-tooltip"
import { CheckboxField } from "@/components/checkbox-field"
import { PendingButton } from "@/components/pending-button"
import { Refusal } from "@/components/refusal"
import { SelectField } from "@/components/select-field"
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
import { NativeSelectOption } from "@/components/ui/native-select"
import { api, call } from "@/lib/api"
import { isChoice, kindLabels, kinds } from "@/lib/fields"
import { customerTypesKey } from "@/lib/queries"
import { fieldPatchSchema, fieldSchema } from "@/lib/schemas"
import type { CustomerDropdown, CustomerField } from "@/lib/types"
import { iconAction } from "./setting-row"

type Input = z.input<typeof fieldSchema>
type Output = z.output<typeof fieldSchema>

const empty: Input = { label: "", kind: "string", dropdown_id: "", required: false, is_unique: false }

// AddFieldDialog adds a field at the end of a customer type. The kind decides
// what else is asked: a choice needs the dropdown it takes its options from,
// and only text and whole numbers may be told not to repeat. The kind and
// the dropdown cannot be changed afterwards.
export function AddFieldDialog({
  companyId,
  typeId,
  dropdowns,
}: {
  companyId: number
  typeId: number
  dropdowns: CustomerDropdown[]
}) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const form = useForm<Input, unknown, Output>({ resolver: zodResolver(fieldSchema), defaultValues: empty })
  const choice = isChoice(useWatch({ control: form.control, name: "kind" }))
  const add = useMutation({
    mutationFn: (field: Output) =>
      call(api.POST("/app/customer-types/{id}/fields", { params: { path: { id: typeId } }, body: field })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerTypesKey(companyId) })
      toast.success("Maydon qo'shildi")
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
      <DialogTrigger render={<Button size="lg" className="px-3.5" />}>
        <PlusIcon />
        Maydon qo&apos;shish
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Maydon qo&apos;shish</DialogTitle>
          <DialogDescription>
            Maydon tur formasining oxiriga qo&apos;shiladi. Turi keyin o&apos;zgartirilmaydi.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((field) => add.mutate(field))} noValidate className="space-y-4">
          <FieldGroup>
            <TextField control={form.control} name="label" label="Nomi" autoComplete="off" />
            <SelectField control={form.control} name="kind" label="Turi">
              {kinds.map((kind) => (
                <NativeSelectOption key={kind} value={kind}>
                  {kindLabels[kind]}
                </NativeSelectOption>
              ))}
            </SelectField>
            {choice && (
              <SelectField control={form.control} name="dropdown_id" label="Dropdown">
                <NativeSelectOption value="">Tanlang</NativeSelectOption>
                {dropdowns.map((dropdown) => (
                  <NativeSelectOption key={dropdown.id} value={dropdown.id}>
                    {dropdown.name}
                  </NativeSelectOption>
                ))}
              </SelectField>
            )}
            {choice && dropdowns.length === 0 && (
              <p className="-mt-3 text-[0.8125rem] leading-5 text-pretty text-muted-foreground">
                Hali dropdown yo&apos;q: avval Sozlamalarda dropdown yarating.
              </p>
            )}
            <CheckboxField control={form.control} name="required" label="Majburiy" />
            {!choice && <CheckboxField control={form.control} name="is_unique" label="Takrorlanmasin" />}
          </FieldGroup>
          {add.isError && <Refusal>{add.error.message}</Refusal>}
          <DialogFooter>
            <PendingButton type="submit" size="lg" className="px-3.5 max-sm:h-10" pending={add.isPending}>
              Qo&apos;shish
            </PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

type PatchInput = z.input<typeof fieldPatchSchema>
type PatchOutput = z.output<typeof fieldPatchSchema>

// EditFieldDialog changes a field's name and marks. Its kind (and, for a
// choice, its dropdown) was decided when it was made: kind says it in words,
// and it is shown, not asked.
export function EditFieldDialog({
  companyId,
  typeId,
  field,
  kind,
}: {
  companyId: number
  typeId: number
  field: CustomerField
  kind: string
}) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const current: PatchInput = { label: field.label, required: field.required, is_unique: field.is_unique }
  const form = useForm<PatchInput, unknown, PatchOutput>({ resolver: zodResolver(fieldPatchSchema), defaultValues: current })
  const save = useMutation({
    mutationFn: (patch: PatchOutput) =>
      call(
        api.PATCH("/app/customer-types/{id}/fields/{fieldId}", {
          params: { path: { id: typeId, fieldId: field.id } },
          body: patch,
        }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerTypesKey(companyId) })
      toast.success("Maydon saqlandi")
      setOpen(false)
    },
  })

  // Every opening starts from the field as it is now.
  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (next) {
      form.reset(current)
      save.reset()
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <ActionTooltip label="Tahrirlash">
        <DialogTrigger
          render={<Button variant="ghost" size="icon" className={iconAction} aria-label={`Tahrirlash: ${field.label}`} />}
        >
          <PencilIcon />
        </DialogTrigger>
      </ActionTooltip>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Maydonni tahrirlash</DialogTitle>
          <DialogDescription>{kind}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((patch) => save.mutate(patch))} noValidate className="space-y-4">
          <FieldGroup>
            <TextField control={form.control} name="label" label="Nomi" autoComplete="off" />
            <CheckboxField control={form.control} name="required" label="Majburiy" />
            {!isChoice(field.kind) && <CheckboxField control={form.control} name="is_unique" label="Takrorlanmasin" />}
          </FieldGroup>
          {save.isError && <Refusal>{save.error.message}</Refusal>}
          <DialogFooter>
            <PendingButton type="submit" size="lg" className="px-3.5 max-sm:h-10" pending={save.isPending}>
              Saqlash
            </PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
