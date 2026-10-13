"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { AmountRow, TextRow } from "@/components/kit/form-row"
import { Group } from "@/components/kit/group"
import { MainButton } from "@/components/kit/main-button"
import { SelectRow } from "@/components/kit/picker-sheet"
import { SheetForm } from "@/components/kit/sheet-form"
import { Refusal } from "@/components/refusal"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { api, call } from "@/lib/api"
import { accountCurrency, accountOptions, useAccounts, useCurrencies } from "@/lib/currencies"
import { type CashOpeningForm, type CashOpeningOutput, cashOpeningDefaults, cashOpeningSchema, forgetFinance } from "@/lib/finance"
import type { CashOpening } from "@/lib/types"
import { nowLocal } from "@/lib/warehouse"

// CashOpeningDialog enters what an account held when the books began
// (logic/finance.md, section 5): the account (the page's, when opened from
// one), the amount in its currency, a moment (now unless another is chosen)
// and a note; or saves the one given with other fields. As the prototype's
// sheet: the account picked in a sheet, the amount with its currency, the
// moment and the note as rows. It is opened from outside (an account's
// tile, a document's «Tahrirlash»).
export function CashOpeningDialog({
  companyId,
  accountId,
  opening,
  open,
  onOpenChange,
}: {
  companyId: number
  accountId?: number
  opening?: CashOpening
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
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
      onOpenChange(false)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
