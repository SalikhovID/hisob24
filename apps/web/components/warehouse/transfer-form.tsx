"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { PendingButton } from "@/components/pending-button"
import { Refusal } from "@/components/refusal"
import { SelectField } from "@/components/select-field"
import { TextField } from "@/components/text-field"
import { FieldGroup } from "@/components/ui/field"
import { UZS } from "@/lib/currencies"
import { type TransferForm as TransferFormValues, type TransferOutput, transferSchema } from "@/lib/stock"
import { useLocation } from "@/lib/use-location"
import { LinesField } from "./lines-field"

// TransferForm is a transfer as it is entered or edited (logic/warehouse.md,
// 5.1): the location it goes to (another of the member's), the moment, the
// lines (a product and its quantity, no prices) and a note. The location
// it comes out of is the page's.
export function TransferForm({
  companyId,
  locationId,
  defaults,
  onSubmit,
  submitLabel,
  pending,
  refusal,
}: {
  companyId: number
  locationId: number
  defaults: TransferFormValues
  onSubmit: (transfer: TransferOutput) => void
  submitLabel: string
  pending: boolean
  refusal?: string
}) {
  const { locations } = useLocation()
  const form = useForm<TransferFormValues, unknown, TransferOutput>({ resolver: zodResolver(transferSchema), defaultValues: defaults })
  const destinations = locations.filter((l) => l.id !== locationId).map((l) => ({ value: String(l.id), label: l.name }))

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-6">
      <FieldGroup>
        <SelectField control={form.control} name="to_location_id" label="Qayerga" placeholder="Tanlang" options={destinations} />
        <TextField control={form.control} name="at" label="Vaqt" type="datetime-local" />
      </FieldGroup>
      <LinesField form={form} companyId={companyId} withPrice={false} currencyId={UZS} pending={pending} />
      <FieldGroup>
        <TextField control={form.control} name="note" label="Izoh" autoComplete="off" />
      </FieldGroup>
      {refusal && <Refusal>{refusal}</Refusal>}
      <PendingButton type="submit" size="lg" className="px-3.5" pending={pending}>
        {submitLabel}
      </PendingButton>
    </form>
  )
}
