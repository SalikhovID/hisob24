"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { AmountRow, TextRow } from "@/components/kit/form-row"
import { Foot, Group } from "@/components/kit/group"
import { MainButton } from "@/components/kit/main-button"
import { SelectRow } from "@/components/kit/picker-sheet"
import { SheetForm } from "@/components/kit/sheet-form"
import { Refusal } from "@/components/refusal"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { api, call } from "@/lib/api"
import { accountCurrency, accountOptions, useAccounts, useCurrencies } from "@/lib/currencies"
import { type ConversionForm, type ConversionOutput, conversionDefaults, conversionRateText, conversionSchema, forgetFinance } from "@/lib/finance"
import type { MoneyTransfer } from "@/lib/types"
import { nowLocal } from "@/lib/warehouse"

// ConversionDialog turns money of one account into money of another, in
// another currency (logic/finance.md, section 5): the account it leaves
// (the page's, when opened from one) and the amount that leaves, an account
// in another currency and the amount that arrives (the rate they come to is
// told as they are typed), a moment and a note; or saves the one given with
// other fields. As the prototype's sheet: the accounts picked in sheets,
// each amount with its currency beside its account, the rate said under
// them, the moment and the note as rows. It is opened from outside (an
// account's tile, a document's «Tahrirlash»).
export function ConversionDialog({
  companyId,
  accountId,
  conversion,
  open,
  onOpenChange,
}: {
  companyId: number
  accountId?: number
  conversion?: MoneyTransfer
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const currencies = useCurrencies()
  const accounts = useAccounts()
  const firstAccount = accountId ?? accounts.find((a) => a.is_active)?.id ?? null
  const form = useForm<ConversionForm, unknown, ConversionOutput>({
    resolver: zodResolver(conversionSchema),
    defaultValues: conversionDefaults(conversion, nowLocal(), firstAccount),
  })
  const [sourceChosen, targetChosen, amount, toAmount] = useWatch({ control: form.control, name: ["from_account_id", "to_account_id", "amount", "to_amount"] })
  const currency = accountCurrency(accounts, currencies, Number(sourceChosen))
  const target = accounts.find((a) => a.id === Number(targetChosen))
  const toCurrency = target ? accountCurrency(accounts, currencies, target.id) : null
  // The targets: the accounts in another currency than the source's.
  const targets = accounts.filter((a) => a.id !== Number(sourceChosen) && a.currency_id !== currency.id)
  const rate = toCurrency ? conversionRateText(amount, toAmount, currency, toCurrency) : null

  const save = useMutation({
    mutationFn: (fields: ConversionOutput) =>
      conversion
        ? call(api.PUT("/app/conversions/{id}", { params: { path: { id: conversion.id } }, body: fields }))
        : call(api.POST("/app/conversions", { body: fields })),
    onSuccess: () => {
      forgetFinance(queryClient, companyId)
      toast.success(conversion ? "Hujjat saqlandi" : "Hujjat qo'shildi")
      onOpenChange(false)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{conversion ? "Konvertatsiyani tahrirlash" : "Konvertatsiya qo'shish"}</DialogTitle>
          <DialogDescription>Bir akkauntdan boshqa valyutali akkauntga: chiqqan va kirgan summa alohida.</DialogDescription>
        </DialogHeader>
        <SheetForm onSubmit={form.handleSubmit((fields) => save.mutate(fields))}>
          {save.isError && <Refusal className="mb-4">{save.error.message}</Refusal>}
          <Group>
            <SelectRow control={form.control} name="from_account_id" label="Qayerdan" options={accountOptions(accounts, currencies, conversion?.from_account_id)} />
            <AmountRow control={form.control} name="amount" label="Chiqdi" suffix={currency.symbol} />
            <SelectRow control={form.control} name="to_account_id" label="Qayerga" options={accountOptions(targets, currencies, conversion?.to_account_id)} />
            <AmountRow control={form.control} name="to_amount" label="Kirdi" suffix={toCurrency?.symbol ?? "…"} />
          </Group>
          {rate && <Foot className="-mt-4 tabular-nums">{rate}</Foot>}
          <Group>
            <TextRow control={form.control} name="at" label="Vaqt" type="datetime-local" />
            <TextRow control={form.control} name="note" label="Izoh" placeholder="ixtiyoriy" autoComplete="off" />
          </Group>
          <DialogFooter>
            <MainButton type="submit" pending={save.isPending}>
              {conversion ? "Saqlash" : "Qo'shish"}
            </MainButton>
          </DialogFooter>
        </SheetForm>
      </DialogContent>
    </Dialog>
  )
}
