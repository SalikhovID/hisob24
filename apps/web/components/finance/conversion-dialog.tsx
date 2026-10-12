"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { PencilIcon, PlusIcon } from "lucide-react"
import { useState } from "react"
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
import { accountCurrency, accountOptions, useAccounts, useCurrencies } from "@/lib/currencies"
import { type ConversionForm, type ConversionOutput, conversionDefaults, conversionRateText, conversionSchema, forgetFinance } from "@/lib/finance"
import { formatAmount } from "@/lib/format"
import type { MoneyTransfer } from "@/lib/types"
import { nowLocal } from "@/lib/warehouse"

// ConversionDialog turns money of one account into money of another, in
// another currency (logic/finance.md, section 5): the account it leaves
// (the page's, when opened from one) and the amount that leaves, an
// account in another currency and the amount that arrives (the rate they
// come to is told as they are typed), a moment and a note; or saves the
// one given with other fields.
export function ConversionDialog({ companyId, accountId, conversion, iconOnly = false }: { companyId: number; accountId?: number; conversion?: MoneyTransfer; iconOnly?: boolean }) {
  const [open, setOpen] = useState(false)
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
      setOpen(false)
    },
  })

  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (next) {
      form.reset(conversionDefaults(conversion, nowLocal(), firstAccount))
      save.reset()
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      {conversion && iconOnly ? (
        <ActionTooltip label="Tahrirlash">
          <DialogTrigger render={<Button variant="ghost" size="icon" className={iconAction} aria-label={`Tahrirlash: ${formatAmount(conversion.amount)}`} />}>
            <PencilIcon />
          </DialogTrigger>
        </ActionTooltip>
      ) : (
        <DialogTrigger render={<Button size={conversion ? "sm" : "lg"} variant={conversion ? "outline" : "default"} className="px-3.5" />}>
          {conversion ? <PencilIcon /> : <PlusIcon />}
          {conversion ? "Tahrirlash" : "Konvertatsiya qo'shish"}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{conversion ? "Konvertatsiyani tahrirlash" : "Konvertatsiya qo'shish"}</DialogTitle>
          <DialogDescription>Bir akkauntdan boshqa valyutali akkauntga: chiqqan va kirgan summa alohida. Ikkala akkaunt, ikkala summa va vaqt majburiy; izoh ixtiyoriy.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((fields) => save.mutate(fields))} noValidate className="space-y-4">
          <FieldGroup>
            <SelectField control={form.control} name="from_account_id" label="Qayerdan" placeholder="Tanlang" options={accountOptions(accounts, currencies, conversion?.from_account_id)} />
            <TextField control={form.control} name="amount" label={`Chiqqan summa, ${currency.symbol}`} inputMode="decimal" autoComplete="off" />
            <SelectField control={form.control} name="to_account_id" label="Qayerga" placeholder="Tanlang" options={accountOptions(targets, currencies, conversion?.to_account_id)} />
            <TextField control={form.control} name="to_amount" label={`Kirgan summa, ${toCurrency?.symbol ?? "…"}`} inputMode="decimal" autoComplete="off" />
            {rate && <p className="text-sm text-muted-foreground tabular-nums">{rate}</p>}
            <TextField control={form.control} name="at" label="Vaqt" type="datetime-local" />
            <TextField control={form.control} name="note" label="Izoh" autoComplete="off" />
          </FieldGroup>
          {save.isError && <Refusal>{save.error.message}</Refusal>}
          <DialogFooter>
            <PendingButton type="submit" size="lg" className="px-3.5 max-sm:h-10" pending={save.isPending}>
              {conversion ? "Saqlash" : "Qo'shish"}
            </PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
