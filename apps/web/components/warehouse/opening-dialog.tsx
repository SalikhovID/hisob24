"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { AmountRow, OptionChips, TextRow } from "@/components/kit/form-row"
import { Group } from "@/components/kit/group"
import { MainButton } from "@/components/kit/main-button"
import { SelectRow } from "@/components/kit/picker-sheet"
import { SheetForm } from "@/components/kit/sheet-form"
import { Refusal } from "@/components/refusal"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { api, call } from "@/lib/api"
import { currencyOf, currencyOptions, isMulti, trimRate, useCurrencies, UZS } from "@/lib/currencies"
import { forgetParty, type Party } from "@/lib/party"
import { type OpeningFields, type OpeningForm, type OpeningOutput, openingDefaults, openingSchema } from "@/lib/stock"
import { nowLocal } from "@/lib/warehouse"

// kindOptions are the two kinds of an opening balance: a debt or an
// advance when the company started keeping its books here: the supplier's
// (what it was owed) or the customer's (what they owed) (logic/warehouse.md,
// section 6; logic/sales.md, section 5).
const kindOptions = [
  { value: "debt", label: "Qarz" },
  { value: "prepay", label: "Avans" },
]

// OpeningDialog enters an opening debt or advance of the party, as the
// prototype's sheet: the kind as chips, an amount in a currency of the
// company's (the so'm unless another is chosen), a moment (now unless
// another is chosen), the rate (with another currency than the so'm) and a
// note; or saves the one given with other fields, its kind staying. The
// statement opens it (its «Boshlang'ich» action, a balance's «Tahrirlash»)
// and mounts it for each opening.
export function OpeningDialog({
  party = "supplier",
  companyId,
  partyId,
  opening,
  open,
  onOpenChange,
}: {
  party?: Party
  companyId: number
  partyId: number
  opening?: OpeningFields
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const currencies = useCurrencies()
  const form = useForm<OpeningForm, unknown, OpeningOutput>({ resolver: zodResolver(openingSchema), defaultValues: openingDefaults(opening, nowLocal()) })
  const currencyId = Number(useWatch({ control: form.control, name: "currency_id" })) || UZS
  const currency = currencyOf(currencies, currencyId)
  const save = useMutation({
    // Either party's answer is its own shape; the dialog needs none of it.
    mutationFn: async (fields: OpeningOutput): Promise<void> => {
      const path = { id: partyId }
      if (party === "customer") {
        await (opening
          ? call(api.PUT("/app/customers/{id}/openings/{openingId}", { params: { path: { ...path, openingId: opening.id } }, body: fields }))
          : call(api.POST("/app/customers/{id}/openings", { params: { path }, body: fields })))
        return
      }
      await (opening
        ? call(api.PUT("/app/suppliers/{id}/openings/{openingId}", { params: { path: { ...path, openingId: opening.id } }, body: fields }))
        : call(api.POST("/app/suppliers/{id}/openings", { params: { path }, body: fields })))
    },
    onSuccess: () => {
      // What is owed changes with every opening balance.
      forgetParty(queryClient, party, companyId, partyId)
      toast.success(opening ? "Hujjat saqlandi" : "Hujjat qo'shildi")
      onOpenChange(false)
    },
  })

  // Another currency: its standard rate is offered while none is typed.
  useEffect(() => {
    if (!open || currencyId === UZS || form.getValues("rate") !== "") return
    if (currency.rate !== null) form.setValue("rate", trimRate(currency.rate))
  }, [open, currencyId, currency.rate, form])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{opening ? "Hujjatni tahrirlash" : "Boshlang'ich qarz yoki avans"}</DialogTitle>
          <DialogDescription>
            {party === "customer" ? "Qarz — mijoz bizga qarzdor, avans — u oldindan to'lagan." : "Qarz — ta'minotchiga qarzimiz, avans — unga oldindan to'langan."}
          </DialogDescription>
        </DialogHeader>
        <SheetForm onSubmit={form.handleSubmit((fields) => save.mutate(fields))}>
          {save.isError && <Refusal className="mb-4">{save.error.message}</Refusal>}
          <Group>
            <OptionChips control={form.control} name="kind" label="Tur" options={kindOptions} disabled={opening !== undefined} />
            {isMulti(currencies) && <SelectRow control={form.control} name="currency_id" label="Valyuta" options={currencyOptions(currencies)} />}
            <AmountRow control={form.control} name="amount" label="Summa" suffix={currency.symbol} />
            <TextRow control={form.control} name="at" label="Vaqt" type="datetime-local" />
            {isMulti(currencies) && currencyId !== UZS && (
              <AmountRow control={form.control} name="rate" label={`1 ${currency.code} = ? so'm`} placeholder="kurs" suffix={null} />
            )}
            <TextRow control={form.control} name="note" label="Izoh" placeholder="ixtiyoriy" autoComplete="off" />
          </Group>
          <DialogFooter>
            <MainButton type="submit" pending={save.isPending}>
              {opening ? "Saqlash" : "Qo'shish"}
            </MainButton>
          </DialogFooter>
        </SheetForm>
      </DialogContent>
    </Dialog>
  )
}
