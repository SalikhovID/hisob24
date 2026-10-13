"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { DateTimeRow } from "@/components/kit/date-sheet"
import { AmountRow, TextRow } from "@/components/kit/form-row"
import { Foot, Group } from "@/components/kit/group"
import { MainButton } from "@/components/kit/main-button"
import { SelectRow } from "@/components/kit/picker-sheet"
import { SheetForm } from "@/components/kit/sheet-form"
import { Refusal } from "@/components/refusal"
import { settingsHref } from "@/components/settings/use-settings-tab"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { api, call } from "@/lib/api"
import { accountCurrency, accountOptions, useAccounts, useCurrencies } from "@/lib/currencies"
import { type ExpenseForm, type ExpenseOutput, expenseDefaults, expenseSchema, forgetFinance } from "@/lib/finance"
import { useFinanceCategories } from "@/lib/queries"
import type { Expense, FinanceKind } from "@/lib/types"
import { nowLocal } from "@/lib/warehouse"

// The words of each kind: what the title and the note say.
const words: Record<FinanceKind, { add: string; edit: string; noun: string }> = {
  expense: { add: "Xarajat qo'shish", edit: "Xarajatni tahrirlash", noun: "xarajat" },
  income: { add: "Kirim qo'shish", edit: "Kirimni tahrirlash", noun: "kirim" },
}

// ExpenseDialog enters an expense out of an account or other income into
// one (logic/finance.md, section 5): the account (the page's, when opened
// from one), a category of the kind (the active ones; the document's own
// stays), the amount in the account's currency, a moment (now unless
// another is chosen) and a note; or saves the one given with other fields,
// its kind staying. Without a category of the kind there is nothing to file
// the document under: the settings make them (settingsAllowed: the way
// there is offered). As the prototype's sheet: the account and the category
// picked in sheets, the amount with the account's currency, the moment and
// the note as rows. It is opened from outside (an account's tile, a
// document's «Tahrirlash»).
export function ExpenseDialog({
  companyId,
  kind,
  accountId,
  expense,
  settingsAllowed = false,
  open,
  onOpenChange,
}: {
  companyId: number
  kind: FinanceKind
  accountId?: number
  expense?: Expense
  settingsAllowed?: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const currencies = useCurrencies()
  const accounts = useAccounts()
  const categories = useFinanceCategories(open ? companyId : null, kind)
  const firstAccount = accountId ?? accounts.find((a) => a.is_active)?.id ?? null
  const form = useForm<ExpenseForm, unknown, ExpenseOutput>({
    resolver: zodResolver(expenseSchema),
    defaultValues: expenseDefaults(expense, nowLocal(), firstAccount, kind),
  })
  const accountChosen = useWatch({ control: form.control, name: "bank_account_id" })
  const currency = accountCurrency(accounts, currencies, Number(accountChosen))
  const offered = (categories.data ?? []).filter((c) => c.is_active || c.id === expense?.category_id)
  const none = categories.data !== undefined && offered.length === 0

  const save = useMutation({
    mutationFn: (fields: ExpenseOutput) =>
      expense ? call(api.PUT("/app/expenses/{id}", { params: { path: { id: expense.id } }, body: fields })) : call(api.POST("/app/expenses", { body: fields })),
    onSuccess: () => {
      forgetFinance(queryClient, companyId)
      toast.success(expense ? "Hujjat saqlandi" : "Hujjat qo'shildi")
      onOpenChange(false)
    },
  })

  const w = words[expense?.kind ?? kind]
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{expense ? w.edit : w.add}</DialogTitle>
          <DialogDescription>Akkaunt, kategoriya, summa va vaqt majburiy; izoh ixtiyoriy.</DialogDescription>
        </DialogHeader>
        <SheetForm onSubmit={form.handleSubmit((fields) => save.mutate(fields))}>
          {save.isError && <Refusal className="mb-4">{save.error.message}</Refusal>}
          <Group>
            <SelectRow control={form.control} name="bank_account_id" label="Akkaunt" options={accountOptions(accounts, currencies, expense?.bank_account_id)} />
            <SelectRow control={form.control} name="category_id" label="Kategoriya" options={offered.map((c) => ({ value: String(c.id), label: c.name }))} />
            <AmountRow control={form.control} name="amount" label="Summa" suffix={currency.symbol} />
            <DateTimeRow control={form.control} name="at" label="Vaqt" />
            <TextRow control={form.control} name="note" label="Izoh" placeholder="ixtiyoriy" autoComplete="off" />
          </Group>
          {none && (
            <Foot className="-mt-4">
              {settingsAllowed ? (
                <>
                  Avval Sozlamalarda {w.noun} kategoriyasini yarating.{" "}
                  <Link href={settingsHref("finance")} className="font-medium text-primary">
                    Sozlamalarni ochish
                  </Link>
                </>
              ) : (
                `Kompaniya egasi Sozlamalarda ${w.noun} kategoriyasini yaratishi kerak.`
              )}
            </Foot>
          )}
          <DialogFooter>
            <MainButton type="submit" pending={save.isPending}>
              {expense ? "Saqlash" : "Qo'shish"}
            </MainButton>
          </DialogFooter>
        </SheetForm>
      </DialogContent>
    </Dialog>
  )
}
