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
import { type CashOpeningForm, type CashOpeningOutput, cashOpeningDefaults, cashOpeningSchema, forgetFinance } from "@/lib/finance"
import { formatAmount } from "@/lib/format"
import type { CashOpening } from "@/lib/types"
import { nowLocal } from "@/lib/warehouse"

// CashOpeningDialog enters what an account held when the books began
// (logic/finance.md, section 5): the account (the page's, when opened from
// one), the amount in its currency, a moment (now unless another is
// chosen) and a note; or saves the one given with other fields.
export function CashOpeningDialog({ companyId, accountId, opening, iconOnly = false }: { companyId: number; accountId?: number; opening?: CashOpening; iconOnly?: boolean }) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const currencies = useCurrencies()
  const accounts = useAccounts()
  const firstAccount = accountId ?? accounts.find((a) => a.is_active)?.id ?? null
  const form = useForm<CashOpeningForm, unknown, CashOpeningOutput>({
    resolver: zodResolver(cashOpeningSchema),
    defaultValues: cashOpeningDefaults(opening, nowLocal(), firstAccount),
  })
  const accountChosen = useWatch({ control: form.control, name: "bank_account_id" })
  const currency = accountCurrency(accounts, currencies, Number(accountChosen))

  const save = useMutation({
    mutationFn: (fields: CashOpeningOutput) =>
      opening
        ? call(api.PUT("/app/cash-openings/{id}", { params: { path: { id: opening.id } }, body: fields }))
        : call(api.POST("/app/cash-openings", { body: fields })),
    onSuccess: () => {
      forgetFinance(queryClient, companyId)
      toast.success(opening ? "Hujjat saqlandi" : "Hujjat qo'shildi")
      setOpen(false)
    },
  })

  // The dialog opens afresh each time: with the document as it is now, or empty, now.
  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (next) {
      form.reset(cashOpeningDefaults(opening, nowLocal(), firstAccount))
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
        <DialogTrigger render={<Button size={opening ? "sm" : "lg"} variant={opening ? "outline" : "default"} className="px-3.5" />}>
          {opening ? <PencilIcon /> : <PlusIcon />}
          {opening ? "Tahrirlash" : "Boshlang'ich qoldiq"}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{opening ? "Boshlang'ich qoldiqni tahrirlash" : "Kassa boshlang'ich qoldig'i"}</DialogTitle>
          <DialogDescription>Tizimni boshlaganda akkauntda bor pul. Akkaunt, summa (akkaunt valyutasida) va vaqt majburiy; izoh ixtiyoriy.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((fields) => save.mutate(fields))} noValidate className="space-y-4">
          <FieldGroup>
            <SelectField control={form.control} name="bank_account_id" label="Akkaunt" placeholder="Tanlang" options={accountOptions(accounts, currencies, opening?.bank_account_id)} />
            <TextField control={form.control} name="amount" label={`Summa, ${currency.symbol}`} inputMode="decimal" autoComplete="off" />
            <TextField control={form.control} name="at" label="Vaqt" type="datetime-local" />
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
