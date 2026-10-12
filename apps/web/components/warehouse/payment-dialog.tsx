"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { PencilIcon, PlusIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { ActionTooltip } from "@/components/action-tooltip"
import { iconAction } from "@/components/catalog/icon-action"
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
import { api, call } from "@/lib/api"
import { accountCurrency, accountOptions, isMulti, trimRate, useAccounts, useCurrencies, UZS } from "@/lib/currencies"
import { formatAmount } from "@/lib/format"
import { forgetParty, type Party } from "@/lib/party"
import { nowLocal, type PaymentFields, type PaymentForm, type PaymentOutput, paymentDefaults, paymentSchema } from "@/lib/warehouse"

// PaymentDialog enters a payment to the supplier (logic/warehouse.md,
// section 6) or from the customer (logic/sales.md, section 5): out of or
// into an account, an amount in its currency, a moment (now unless another
// is chosen), the rate (with another currency than the so'm) and a note;
// or saves the one given, entered on its own, with other fields.
export function PaymentDialog({
  party = "supplier",
  companyId,
  partyId,
  payment,
  iconOnly = false,
}: {
  party?: Party
  companyId: number
  partyId: number
  payment?: PaymentFields
  iconOnly?: boolean
}) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const currencies = useCurrencies()
  const accounts = useAccounts()
  const firstAccount = accounts.find((a) => a.is_active)?.id ?? null
  const form = useForm<PaymentForm, unknown, PaymentOutput>({
    resolver: zodResolver(paymentSchema),
    defaultValues: paymentDefaults(payment, nowLocal(), firstAccount),
  })
  const accountId = Number(form.watch("bank_account_id"))
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
      setOpen(false)
    },
  })

  // An account in another currency: its standard rate is offered while
  // none is typed.
  useEffect(() => {
    if (!open || currency.id === UZS || form.getValues("rate") !== "") return
    if (currency.rate !== null) form.setValue("rate", trimRate(currency.rate))
  }, [open, currency, form])

  // Every opening starts from the payment as it is now, or from an empty
  // form dated now, out of the first account.
  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (next) {
      form.reset(paymentDefaults(payment, nowLocal(), firstAccount))
      save.reset()
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      {payment && iconOnly ? (
        <ActionTooltip label="Tahrirlash">
          <DialogTrigger render={<Button variant="ghost" size="icon" className={iconAction} aria-label={`Tahrirlash: ${formatAmount(payment.amount)}`} />}>
            <PencilIcon />
          </DialogTrigger>
        </ActionTooltip>
      ) : (
        <DialogTrigger render={<Button size={payment ? "sm" : "lg"} variant={payment ? "outline" : "default"} className="px-3.5" />}>
          {payment ? <PencilIcon /> : <PlusIcon />}
          {payment ? "Tahrirlash" : "To'lov qo'shish"}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{payment ? "To'lovni tahrirlash" : "To'lov qo'shish"}</DialogTitle>
          <DialogDescription>Akkaunt, summa (akkaunt valyutasida) va vaqt majburiy; izoh ixtiyoriy.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((fields) => save.mutate(fields))} noValidate className="space-y-4">
          <FieldGroup>
            <SelectField control={form.control} name="bank_account_id" label="Akkaunt" placeholder="Tanlang" options={accountOptions(accounts, currencies, payment?.bank_account_id)} />
            <TextField control={form.control} name="amount" label={`Summa, ${currency.symbol}`} inputMode="decimal" autoComplete="off" />
            <TextField control={form.control} name="at" label="Vaqt" type="datetime-local" />
            {isMulti(currencies) && currency.id !== UZS && (
              <TextField control={form.control} name="rate" label={`1 ${currency.code} = ? so'm`} inputMode="decimal" autoComplete="off" />
            )}
            <TextField control={form.control} name="note" label="Izoh" autoComplete="off" />
          </FieldGroup>
          {save.isError && <Refusal>{save.error.message}</Refusal>}
          <DialogFooter>
            <PendingButton type="submit" size="lg" className="px-3.5 max-sm:h-10" pending={save.isPending}>
              {payment ? "Saqlash" : "Qo'shish"}
            </PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
