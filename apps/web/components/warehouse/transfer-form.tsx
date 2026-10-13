"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { DateTimeRow } from "@/components/kit/date-sheet"
import { TextRow } from "@/components/kit/form-row"
import { Group } from "@/components/kit/group"
import { MainBar, MainButton } from "@/components/kit/main-button"
import { SelectRow } from "@/components/kit/picker-sheet"
import { Refusal } from "@/components/refusal"
import { UZS } from "@/lib/currencies"
import { type TransferForm as TransferFormValues, type TransferOutput, transferSchema } from "@/lib/stock"
import { useLocation } from "@/lib/use-location"
import { LinesField } from "./lines-field"

// TransferForm is a transfer as it is entered or edited (logic/warehouse.md,
// 5.1), as the prototype's document form: the location it goes to (another
// of the member's, picked in a sheet) and the moment as rows, the lines (a
// product and its quantity, no prices) as cards, a note, the main button in
// the bar at the bottom. The location it comes out of is the page's.
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
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-1 flex-col [&>*]:shrink-0">
      {refusal && <Refusal className="mb-4">{refusal}</Refusal>}
      <Group>
        <SelectRow control={form.control} name="to_location_id" label="Qayerga" options={destinations} />
        <DateTimeRow control={form.control} name="at" label="Vaqt" />
      </Group>
      <LinesField form={form} companyId={companyId} withPrice={false} currencyId={UZS} pending={pending} />
      <Group>
        <TextRow control={form.control} name="note" label="Izoh" placeholder="ixtiyoriy" autoComplete="off" />
      </Group>
      <MainBar>
        <MainButton type="submit" pending={pending}>
          {submitLabel}
        </MainButton>
      </MainBar>
    </form>
  )
}
