"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"
import { FormRow, SwitchRow, TextRow } from "@/components/kit/form-row"
import { Foot, Group, Row } from "@/components/kit/group"
import { MainButton } from "@/components/kit/main-button"
import { SelectRow } from "@/components/kit/picker-sheet"
import { SheetForm } from "@/components/kit/sheet-form"
import { Refusal } from "@/components/refusal"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { isChoice, kindLabels, kinds } from "@/lib/fields"
import { fieldPatchSchema, fieldSchema } from "@/lib/schemas"
import type { CustomerDropdown, CustomerFieldKind } from "@/lib/types"

type Input = z.input<typeof fieldSchema>
export type FieldOutput = z.output<typeof fieldSchema>
type PatchInput = z.input<typeof fieldPatchSchema>
export type FieldPatchOutput = z.output<typeof fieldPatchSchema>

const empty: Input = { label: "", kind: "string", dropdown_id: "", required: false, is_unique: false }

// uniqueNote says what the mark that keeps a field's answers apart means.
const uniqueNote = "Takrorlanmas maydon qiymati ikki mijozda bir xil bo'lmaydi (masalan, INN)."

// AddFieldSheet adds a field at the end of a type, a customer type or a
// task type, as the prototype's sheet: the name a row, the kind picked in a
// sheet and, for a choice, the dropdown it takes its options from; the
// marks as switches (where the type's fields may be told not to repeat,
// text and whole numbers get that one). The kind and the dropdown cannot be
// changed afterwards. What adding does is the caller's (add); a refusal
// shows the API's reason in the sheet. It is opened from outside (the type's plus).
export function AddFieldSheet({
  dropdowns,
  unique,
  add,
  open,
  onOpenChange,
}: {
  dropdowns: CustomerDropdown[]
  unique: boolean
  add: (field: FieldOutput) => Promise<unknown>
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const form = useForm<Input, unknown, FieldOutput>({ resolver: zodResolver(fieldSchema), defaultValues: empty })
  const choice = isChoice(useWatch({ control: form.control, name: "kind" }))
  const save = useMutation({
    mutationFn: add,
    onSuccess: () => {
      toast.success("Maydon qo'shildi")
      onOpenChange(false)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Maydon qo&apos;shish</DialogTitle>
          <DialogDescription>Maydon tur formasining oxiriga qo&apos;shiladi. Turi keyin o&apos;zgartirilmaydi.</DialogDescription>
        </DialogHeader>
        <SheetForm onSubmit={form.handleSubmit((field) => save.mutate(field))}>
          {save.isError && <Refusal className="mb-4">{save.error.message}</Refusal>}
          <Group>
            <TextRow control={form.control} name="label" label="Nomi" placeholder="Masalan, Manba" autoComplete="off" />
            <SelectRow control={form.control} name="kind" label="Turi" options={kinds.map((kind) => ({ value: kind, label: kindLabels[kind] }))} />
            {choice && (
              <SelectRow
                control={form.control}
                name="dropdown_id"
                label="Dropdown"
                options={dropdowns.map((dropdown) => ({ value: String(dropdown.id), label: dropdown.name }))}
              />
            )}
          </Group>
          {choice && dropdowns.length === 0 && <Foot className="-mt-4">Hali dropdown yo&apos;q: avval Sozlamalarda dropdown yarating.</Foot>}
          <Group>
            <SwitchRow control={form.control} name="required" label="Majburiy" />
            {unique && !choice && <SwitchRow control={form.control} name="is_unique" label="Takrorlanmasin" />}
          </Group>
          {unique && !choice && <Foot className="-mt-4">{uniqueNote}</Foot>}
          <DialogFooter>
            <MainButton type="submit" pending={save.isPending}>
              Qo&apos;shish
            </MainButton>
          </DialogFooter>
        </SheetForm>
      </DialogContent>
    </Dialog>
  )
}

// EditFieldSheet changes a field's name and marks, as the prototype's
// sheet. Its kind (and, for a choice, its dropdown) was decided when it was
// made: kind says it in words, and it is shown, not asked. What saving does
// is the caller's (save); onDelete is the danger row's (the caller asks and
// deletes). It is opened from outside (the field's row).
export function EditFieldSheet({
  field,
  kind,
  unique,
  save,
  onDelete,
  open,
  onOpenChange,
}: {
  field: { label: string; kind: CustomerFieldKind; required: boolean; is_unique?: boolean }
  kind: string
  unique: boolean
  save: (patch: FieldPatchOutput) => Promise<unknown>
  onDelete?: () => void
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const current: PatchInput = { label: field.label, required: field.required, is_unique: field.is_unique ?? false }
  const form = useForm<PatchInput, unknown, FieldPatchOutput>({ resolver: zodResolver(fieldPatchSchema), defaultValues: current })
  const marksUnique = unique && !isChoice(field.kind)
  const saving = useMutation({
    mutationFn: save,
    onSuccess: () => {
      toast.success("Maydon saqlandi")
      onOpenChange(false)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Maydonni tahrirlash</DialogTitle>
        </DialogHeader>
        <SheetForm onSubmit={form.handleSubmit((patch) => saving.mutate(patch))}>
          {saving.isError && <Refusal className="mb-4">{saving.error.message}</Refusal>}
          <Group>
            <TextRow control={form.control} name="label" label="Nomi" autoComplete="off" />
            <FormRow label="Turi">
              <span className="min-w-0 flex-1 text-base text-muted-foreground">{kind}</span>
            </FormRow>
          </Group>
          <Foot className="-mt-4">Maydon turi yaratilgandan keyin o&apos;zgarmaydi.</Foot>
          <Group>
            <SwitchRow control={form.control} name="required" label="Majburiy" />
            {marksUnique && <SwitchRow control={form.control} name="is_unique" label="Takrorlanmasin" />}
          </Group>
          {marksUnique && <Foot className="-mt-4">{uniqueNote}</Foot>}
          {onDelete && (
            <Group>
              <Row variant="danger" onClick={onDelete} title="Maydonni o'chirish" />
            </Group>
          )}
          <DialogFooter>
            <MainButton type="submit" pending={saving.isPending}>
              Saqlash
            </MainButton>
          </DialogFooter>
        </SheetForm>
      </DialogContent>
    </Dialog>
  )
}
