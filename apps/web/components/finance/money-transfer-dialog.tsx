"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { DateTimeRow } from "@/components/kit/date-sheet"
import { AmountRow, TextRow } from "@/components/kit/form-row"
import { Group } from "@/components/kit/group"
import { MainButton } from "@/components/kit/main-button"
import { SelectRow } from "@/components/kit/picker-sheet"
import { SheetForm } from "@/components/kit/sheet-form"
import { Refusal } from "@/components/refusal"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { api, call } from "@/lib/api"
import { accountCurrency, accountOptions, useAccounts, useCurrencies } from "@/lib/currencies"
import { forgetFinance, type MoneyTransferForm, type MoneyTransferOutput, moneyTransferDefaults, moneyTransferSchema } from "@/lib/finance"
import type { MoneyTransfer } from "@/lib/types"
import { nowLocal } from "@/lib/warehouse"

// MoneyTransferDialog moves money from one account to another in the same
// currency (logic/finance.md, section 5): the account it leaves (the
// page's, when opened from one), another in its currency it arrives in, the
// amount, a moment (now unless another is chosen) and a note; or saves the
// one given with other fields. As the prototype's sheet: both accounts
// picked in sheets, the amount with its currency, the moment and the note
// as rows. It is opened from outside (an account's tile, a document's
// «Tahrirlash»).
export function MoneyTransferDialog({
  companyId,
  accountId,
  transfer,
  open,
  onOpenChange,
}: {
  companyId: number
  accountId?: number
  transfer?: MoneyTransfer
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
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
      onOpenChange(false)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{transfer ? "O'tkazmani tahrirlash" : "O'tkazma qo'shish"}</DialogTitle>
          <DialogDescription>Bir akkauntdan boshqasiga, shu valyutada.</DialogDescription>
        </DialogHeader>
        <SheetForm onSubmit={form.handleSubmit((fields) => save.mutate(fields))}>
          {save.isError && <Refusal className="mb-4">{save.error.message}</Refusal>}
          <Group>
            <SelectRow control={form.control} name="from_account_id" label="Qayerdan" options={accountOptions(accounts, currencies, transfer?.from_account_id)} />
            <SelectRow control={form.control} name="to_account_id" label="Qayerga" options={accountOptions(targets, currencies, transfer?.to_account_id)} />
            <AmountRow control={form.control} name="amount" label="Summa" suffix={currency.symbol} />
            <DateTimeRow control={form.control} name="at" label="Vaqt" />
            <TextRow control={form.control} name="note" label="Izoh" placeholder="ixtiyoriy" autoComplete="off" />
          </Group>
          <DialogFooter>
            <MainButton type="submit" pending={save.isPending}>
              {transfer ? "Saqlash" : "Qo'shish"}
            </MainButton>
          </DialogFooter>
        </SheetForm>
      </DialogContent>
    </Dialog>
  )
}
