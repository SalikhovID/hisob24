"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { PencilIcon, ScaleIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { ActionTooltip } from "@/components/action-tooltip"
import { iconAction } from "@/components/catalog/icon-action"
import { PendingButton } from "@/components/pending-button"
import { Refusal } from "@/components/refusal"
import { SelectField } from "@/components/select-field"
import { TextField } from "@/components/text-field"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { FieldGroup } from "@/components/ui/field"
import { api, call } from "@/lib/api"
import { currencyOf, currencyOptions, isMulti, trimRate, useCurrencies, UZS } from "@/lib/currencies"
import { formatAmount } from "@/lib/format"
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

// OpeningDialog enters an opening debt or advance of the party: the kind,
// an amount in a currency of the company's (the so'm unless another is
// chosen), a moment (now unless another is chosen), the rate (with another
// currency than the so'm) and a note; or saves the one given with other
// fields, its kind staying.
export function OpeningDialog({ party = "supplier", companyId, partyId, opening, iconOnly = false }: { party?: Party; companyId: number; partyId: number; opening?: OpeningFields; iconOnly?: boolean }) {
  const [open, setOpen] = useState(false)
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
      setOpen(false)
    },
  })

  // Another currency: its standard rate is offered while none is typed.
  useEffect(() => {
    if (!open || currencyId === UZS || form.getValues("rate") !== "") return
    if (currency.rate !== null) form.setValue("rate", trimRate(currency.rate))
  }, [open, currencyId, currency.rate, form])

  // Every opening starts from the balance as it is now, or from an empty
  // form dated now, in so'm.
  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (next) {
      form.reset(openingDefaults(opening, nowLocal()))
      save.reset()
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      {opening && iconOnly ? (
        <ActionTooltip label="Tahrirlash">
          <DialogTrigger render={<Button variant="ghost" size="icon" className={iconAction} aria-label={`Tahrirlash: ${formatAmount(opening.amount)}`} />}>
            <PencilIcon />
          </DialogTrigger>
        </ActionTooltip>
      ) : (
        <DialogTrigger render={<Button size={opening ? "sm" : "lg"} variant="outline" className="px-3.5" />}>
          {opening ? <PencilIcon /> : <ScaleIcon />}
          {opening ? "Tahrirlash" : "Boshlang'ich qarz / avans"}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{opening ? "Hujjatni tahrirlash" : "Boshlang'ich qarz yoki avans"}</DialogTitle>
          <DialogDescription>
            {party === "customer" ? "Qarz — mijoz bizga qarzdor, avans — u oldindan to'lagan." : "Qarz — ta'minotchiga qarzimiz, avans — unga oldindan to'langan."} Tur, summa va vaqt majburiy; izoh
            ixtiyoriy.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((fields) => save.mutate(fields))} noValidate className="space-y-4">
          <FieldGroup>
            <SelectField control={form.control} name="kind" label="Tur" placeholder="Tanlang" options={kindOptions} disabled={opening !== undefined} />
            {isMulti(currencies) && <SelectField control={form.control} name="currency_id" label="Valyuta" options={currencyOptions(currencies)} />}
            <TextField control={form.control} name="amount" label={`Summa, ${currency.symbol}`} inputMode="decimal" autoComplete="off" />
            <TextField control={form.control} name="at" label="Vaqt" type="datetime-local" />
            {isMulti(currencies) && currencyId !== UZS && (
              <TextField control={form.control} name="rate" label={`1 ${currency.code} = ? so'm`} inputMode="decimal" autoComplete="off" />
            )}
            <TextField control={form.control} name="note" label="Izoh" autoComplete="off" />
          </FieldGroup>
          {save.isError && <Refusal>{save.error.message}</Refusal>}
          <DialogFooter>
            <PendingButton type="submit" size="lg" className="px-3.5 max-sm:h-10" pending={save.isPending}>
              {opening ? "Saqlash" : "Qo'shish"}
            </PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
