"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { PencilIcon, PlusIcon } from "lucide-react"
import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { ActionTooltip } from "@/components/action-tooltip"
import { iconAction } from "@/components/catalog/icon-action"
import { AmountRow, TextRow } from "@/components/kit/form-row"
import { Group } from "@/components/kit/group"
import { MainButton } from "@/components/kit/main-button"
import { SelectRow } from "@/components/kit/picker-sheet"
import { SheetForm } from "@/components/kit/sheet-form"
import { Refusal } from "@/components/refusal"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { api, call } from "@/lib/api"
import { accountCurrency, accountOptions, useAccounts, useCurrencies } from "@/lib/currencies"
import { type CashOpeningForm, type CashOpeningOutput, cashOpeningDefaults, cashOpeningSchema, forgetFinance } from "@/lib/finance"
import { formatAmount } from "@/lib/format"
import type { CashOpening } from "@/lib/types"
import { nowLocal } from "@/lib/warehouse"

// CashOpeningDialog enters what an account held when the books began
// (logic/finance.md, section 5): the account (the page's, when opened from
// one), the amount in its currency, a moment (now unless another is
// chosen) and a note; or saves the one given with other fields. As the
// prototype's sheet: the account picked in a sheet, the amount with its
// currency, the moment and the note as rows. open, with onOpenChange,
// opens it from outside (an account's tile, a document's «Tahrirlash»): it
// has no button then.
export function CashOpeningDialog({
  companyId,
  accountId,
  opening,
  iconOnly = false,
  open: openGiven,
  onOpenChange,
}: {
  companyId: number
  accountId?: number
  opening?: CashOpening
  iconOnly?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [openOwn, setOpenOwn] = useState(false)
  const controlled = openGiven !== undefined
  const open = controlled ? openGiven : openOwn
  const setOpen = (next: boolean) => (controlled ? onOpenChange?.(next) : setOpenOwn(next))
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
      {controlled ? null : opening && iconOnly ? (
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{opening ? "Boshlang'ich qoldiqni tahrirlash" : "Kassa boshlang'ich qoldig'i"}</DialogTitle>
          <DialogDescription>Tizimni boshlaganda akkauntda bor pul.</DialogDescription>
        </DialogHeader>
        <SheetForm onSubmit={form.handleSubmit((fields) => save.mutate(fields))}>
          {save.isError && <Refusal className="mb-4">{save.error.message}</Refusal>}
          <Group>
            <SelectRow control={form.control} name="bank_account_id" label="Akkaunt" options={accountOptions(accounts, currencies, opening?.bank_account_id)} />
            <AmountRow control={form.control} name="amount" label="Summa" suffix={currency.symbol} />
            <TextRow control={form.control} name="at" label="Vaqt" type="datetime-local" />
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
