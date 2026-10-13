"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { AmountSheet, decimalToTyped } from "@/components/kit/amount-sheet"
import { AmountRow, TextRow } from "@/components/kit/form-row"
import { Group } from "@/components/kit/group"
import { SelectRow } from "@/components/kit/picker-sheet"
import { Refusal } from "@/components/refusal"
import { api, call } from "@/lib/api"
import { accountCurrency, accountOptions, isMulti, trimRate, useAccounts, useCurrencies, UZS } from "@/lib/currencies"
import { formatAmount } from "@/lib/format"
import { forgetParty, type Party } from "@/lib/party"
import { nowLocal, type PaymentFields, type PaymentForm, type PaymentOutput, paymentDefaults, paymentSchema } from "@/lib/warehouse"

// PaymentDialog enters a payment to the supplier (logic/warehouse.md,
// section 6) or from the customer (logic/sales.md, section 5), or saves the
// one given, entered on its own, as the prototype's amount sheet: the amount
// typed on the keypad in its account's currency (what is owed in so'm said
// under it, with «To'liq» to type it whole), then the account, the moment
// (now unless another is chosen), the rate (with another currency than the
// so'm) and a note. A page opens it (the «To'lov» tile, a payment's
// «Tahrirlash») and mounts it for each opening; partyName heads it, owed is
// what the party owes in so'm when it is known.
export function PaymentDialog({
  party = "supplier",
  companyId,
  partyId,
  partyName,
  owed,
  payment,
  open,
  onOpenChange,
}: {
  party?: Party
  companyId: number
  partyId: number
  partyName?: string
  owed?: string | null
  payment?: PaymentFields
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const currencies = useCurrencies()
  const accounts = useAccounts()
  const firstAccount = accounts.find((a) => a.is_active)?.id ?? null
  const defaults = paymentDefaults(payment, nowLocal(), firstAccount)
  const form = useForm<PaymentForm, unknown, PaymentOutput>({
    resolver: zodResolver(paymentSchema),
    // The keypad types an amount its own way ("1200,5").
    defaultValues: { ...defaults, amount: decimalToTyped(defaults.amount) },
  })
  const accountId = Number(useWatch({ control: form.control, name: "bank_account_id" }))
  const amount = useWatch({ control: form.control, name: "amount" })
  const currency = accountCurrency(accounts, currencies, accountId)
  const save = useMutation({
    // Either party's answer is its own shape; the dialog needs none of it.
    mutationFn: async (fields: PaymentOutput): Promise<void> => {
      const path = { id: partyId }
      if (party === "customer") {
        await (payment
          ? call(api.PUT("/app/customers/{id}/payments/{paymentId}", { params: { path: { ...path, paymentId: payment.id } }, body: fields }))
          : call(api.POST("/app/customers/{id}/payments", { params: { path }, body: fields })))
        return
      }
      await (payment
        ? call(api.PUT("/app/suppliers/{id}/payments/{paymentId}", { params: { path: { ...path, paymentId: payment.id } }, body: fields }))
        : call(api.POST("/app/suppliers/{id}/payments", { params: { path }, body: fields })))
    },
    onSuccess: () => {
      // What is owed changes with every payment.
      forgetParty(queryClient, party, companyId, partyId)
      toast.success(payment ? "To'lov saqlandi" : "To'lov qo'shildi")
      onOpenChange(false)
    },
  })

  // The accounts come with the session: a new payment opened before they
  // are known takes the first one once they are.
  useEffect(() => {
    if (!open || payment || firstAccount === null || form.getValues("bank_account_id") !== "") return
    form.setValue("bank_account_id", String(firstAccount))
  }, [open, payment, firstAccount, form])

  // An account in another currency: its standard rate is offered while
  // none is typed.
  useEffect(() => {
    if (!open || currency.id === UZS || form.getValues("rate") !== "") return
    if (currency.rate !== null) form.setValue("rate", trimRate(currency.rate))
  }, [open, currency, form])

  // What is owed in so'm, said under the amount; a payment being edited is
  // owed again. It is offered whole when it is a debt and the account is in so'm.
  const debt = owed === undefined || owed === null ? null : Number(owed) + (payment && payment.currency_id === UZS ? Number(payment.amount) : 0)
  const hint =
    debt === null ? undefined : debt > 0 ? `Qarz: ${formatAmount(debt.toFixed(2))} so'm` : debt < 0 ? `Avans: ${formatAmount((-debt).toFixed(2))} so'm` : "Qarz yo'q"
  const full = debt !== null && debt > 0 && currency.id === UZS ? () => form.setValue("amount", decimalToTyped(debt.toFixed(2))) : undefined

  return (
    <AmountSheet
      open={open}
      onOpenChange={onOpenChange}
      title={payment ? "To'lovni tahrirlash" : "To'lov qo'shish"}
      subtitle={partyName}
      value={amount}
      onChange={(next) => form.setValue("amount", next, { shouldValidate: form.formState.isSubmitted })}
      hint={hint}
      onFull={full}
      error={form.formState.errors.amount?.message}
      unit={currency.symbol}
      submitLabel={payment ? "Saqlash" : "Qo'shish"}
      onSubmit={() => form.handleSubmit((fields) => save.mutate(fields))()}
      pending={save.isPending}
    >
      {save.isError && <Refusal className="mb-3">{save.error.message}</Refusal>}
      <Group className="mb-2">
        <SelectRow control={form.control} name="bank_account_id" label="Akkaunt" options={accountOptions(accounts, currencies, payment?.bank_account_id)} />
        <TextRow control={form.control} name="at" label="Vaqt" type="datetime-local" />
        {isMulti(currencies) && currency.id !== UZS && (
          <AmountRow control={form.control} name="rate" label={`1 ${currency.code} = ? so'm`} placeholder="kurs" suffix={null} />
        )}
        <TextRow control={form.control} name="note" label="Izoh" placeholder="ixtiyoriy" autoComplete="off" />
      </Group>
    </AmountSheet>
  )
}
