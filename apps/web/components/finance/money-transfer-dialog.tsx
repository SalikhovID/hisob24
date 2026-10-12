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
import { forgetFinance, type MoneyTransferForm, type MoneyTransferOutput, moneyTransferDefaults, moneyTransferSchema } from "@/lib/finance"
import { formatAmount } from "@/lib/format"
import type { MoneyTransfer } from "@/lib/types"
import { nowLocal } from "@/lib/warehouse"

// MoneyTransferDialog moves money from one account to another in the same
// currency (logic/finance.md, section 5): the account it leaves (the
// page's, when opened from one), another in its currency it arrives in,
// the amount, a moment (now unless another is chosen) and a note; or saves
// the one given with other fields.
export function MoneyTransferDialog({ companyId, accountId, transfer, iconOnly = false }: { companyId: number; accountId?: number; transfer?: MoneyTransfer; iconOnly?: boolean }) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const currencies = useCurrencies()
  const accounts = useAccounts()
  const firstAccount = accountId ?? accounts.find((a) => a.is_active)?.id ?? null
  const form = useForm<MoneyTransferForm, unknown, MoneyTransferOutput>({
    resolver: zodResolver(moneyTransferSchema),
    defaultValues: moneyTransferDefaults(transfer, nowLocal(), firstAccount),
  })
  const sourceChosen = Number(useWatch({ control: form.control, name: "from_account_id" }))
  const currency = accountCurrency(accounts, currencies, sourceChosen)
  // The targets: the other accounts in the source's currency.
  const targets = accounts.filter((a) => a.id !== sourceChosen && a.currency_id === currency.id)

  const save = useMutation({
    mutationFn: (fields: MoneyTransferOutput) =>
      transfer
        ? call(api.PUT("/app/money-transfers/{id}", { params: { path: { id: transfer.id } }, body: fields }))
        : call(api.POST("/app/money-transfers", { body: fields })),
    onSuccess: () => {
      forgetFinance(queryClient, companyId)
      toast.success(transfer ? "Hujjat saqlandi" : "Hujjat qo'shildi")
      setOpen(false)
    },
  })

  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (next) {
      form.reset(moneyTransferDefaults(transfer, nowLocal(), firstAccount))
      save.reset()
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      {transfer && iconOnly ? (
        <ActionTooltip label="Tahrirlash">
          <DialogTrigger render={<Button variant="ghost" size="icon" className={iconAction} aria-label={`Tahrirlash: ${formatAmount(transfer.amount)}`} />}>
            <PencilIcon />
          </DialogTrigger>
        </ActionTooltip>
      ) : (
        <DialogTrigger render={<Button size={transfer ? "sm" : "lg"} variant={transfer ? "outline" : "default"} className="px-3.5" />}>
          {transfer ? <PencilIcon /> : <PlusIcon />}
          {transfer ? "Tahrirlash" : "O'tkazma qo'shish"}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{transfer ? "O'tkazmani tahrirlash" : "O'tkazma qo'shish"}</DialogTitle>
          <DialogDescription>Bir akkauntdan boshqasiga, shu valyutada. Ikkala akkaunt, summa va vaqt majburiy; izoh ixtiyoriy.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((fields) => save.mutate(fields))} noValidate className="space-y-4">
          <FieldGroup>
            <SelectField control={form.control} name="from_account_id" label="Qayerdan" placeholder="Tanlang" options={accountOptions(accounts, currencies, transfer?.from_account_id)} />
            <SelectField control={form.control} name="to_account_id" label="Qayerga" placeholder="Tanlang" options={accountOptions(targets, currencies, transfer?.to_account_id)} />
            <TextField control={form.control} name="amount" label={`Summa, ${currency.symbol}`} inputMode="decimal" autoComplete="off" />
            <TextField control={form.control} name="at" label="Vaqt" type="datetime-local" />
            <TextField control={form.control} name="note" label="Izoh" autoComplete="off" />
          </FieldGroup>
          {save.isError && <Refusal>{save.error.message}</Refusal>}
          <DialogFooter>
            <PendingButton type="submit" size="lg" className="px-3.5 max-sm:h-10" pending={save.isPending}>
              {transfer ? "Saqlash" : "Qo'shish"}
            </PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
