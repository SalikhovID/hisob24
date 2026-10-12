"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { PencilIcon, PlusIcon } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { ActionTooltip } from "@/components/action-tooltip"
import { iconAction } from "@/components/catalog/icon-action"
import { PendingButton } from "@/components/pending-button"
import { Refusal } from "@/components/refusal"
import { SelectField } from "@/components/select-field"
import { settingsHref } from "@/components/settings/use-settings-tab"
import { TextField } from "@/components/text-field"
import { Button, buttonVariants } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { FieldGroup } from "@/components/ui/field"
import { api, call } from "@/lib/api"
import { accountCurrency, accountOptions, useAccounts, useCurrencies } from "@/lib/currencies"
import { type ExpenseForm, type ExpenseOutput, expenseDefaults, expenseSchema, forgetFinance } from "@/lib/finance"
import { formatAmount } from "@/lib/format"
import { useFinanceCategories } from "@/lib/queries"
import type { Expense, FinanceKind } from "@/lib/types"
import { nowLocal } from "@/lib/warehouse"

// The words of each kind: what the button, the title and the note say.
const words: Record<FinanceKind, { add: string; edit: string; noun: string }> = {
  expense: { add: "Xarajat qo'shish", edit: "Xarajatni tahrirlash", noun: "xarajat" },
  income: { add: "Kirim qo'shish", edit: "Kirimni tahrirlash", noun: "kirim" },
}

// ExpenseDialog enters an expense out of an account or other income into
// one (logic/finance.md, section 5): the account (the page's, when opened
// from one), a category of the kind (the active ones; the document's own
// stays), the amount in the account's currency, a moment (now unless
// another is chosen) and a note; or saves the one given with other fields,
// its kind staying. Without a category of the kind there is nothing to
// file the document under: the settings make them (settingsAllowed: the
// way there is offered).
export function ExpenseDialog({
  companyId,
  kind,
  accountId,
  expense,
  iconOnly = false,
  settingsAllowed = false,
}: {
  companyId: number
  kind: FinanceKind
  accountId?: number
  expense?: Expense
  iconOnly?: boolean
  settingsAllowed?: boolean
}) {
  const [open, setOpen] = useState(false)
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
      setOpen(false)
    },
  })

  // The dialog opens afresh each time: with the document as it is now, or empty, now.
  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (next) {
      form.reset(expenseDefaults(expense, nowLocal(), firstAccount, kind))
      save.reset()
    }
  }

  const w = words[expense?.kind ?? kind]
  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      {expense && iconOnly ? (
        <ActionTooltip label="Tahrirlash">
          <DialogTrigger render={<Button variant="ghost" size="icon" className={iconAction} aria-label={`Tahrirlash: ${formatAmount(expense.amount)}`} />}>
            <PencilIcon />
          </DialogTrigger>
        </ActionTooltip>
      ) : (
        <DialogTrigger render={<Button size={expense ? "sm" : "lg"} variant={expense ? "outline" : "default"} className="px-3.5" />}>
          {expense ? <PencilIcon /> : <PlusIcon />}
          {expense ? "Tahrirlash" : w.add}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{expense ? w.edit : w.add}</DialogTitle>
          <DialogDescription>Akkaunt, kategoriya, summa (akkaunt valyutasida) va vaqt majburiy; izoh ixtiyoriy.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((fields) => save.mutate(fields))} noValidate className="space-y-4">
          <FieldGroup>
            <SelectField control={form.control} name="bank_account_id" label="Akkaunt" placeholder="Tanlang" options={accountOptions(accounts, currencies, expense?.bank_account_id)} />
            <SelectField control={form.control} name="category_id" label="Kategoriya" placeholder="Tanlang" options={offered.map((c) => ({ value: String(c.id), label: c.name }))} />
            {none && (
              <p className="text-sm text-muted-foreground">
                {settingsAllowed ? (
                  <>
                    Avval Sozlamalarda {w.noun} kategoriyasini yarating.{" "}
                    <Link href={settingsHref("finance")} className={buttonVariants({ variant: "link", size: "sm", className: "h-auto p-0" })}>
                      Sozlamalarni ochish
                    </Link>
                  </>
                ) : (
                  `Kompaniya egasi Sozlamalarda ${w.noun} kategoriyasini yaratishi kerak.`
                )}
              </p>
            )}
            <TextField control={form.control} name="amount" label={`Summa, ${currency.symbol}`} inputMode="decimal" autoComplete="off" />
            <TextField control={form.control} name="at" label="Vaqt" type="datetime-local" />
            <TextField control={form.control} name="note" label="Izoh" autoComplete="off" />
          </FieldGroup>
          {save.isError && <Refusal>{save.error.message}</Refusal>}
          <DialogFooter>
            <PendingButton type="submit" size="lg" className="px-3.5 max-sm:h-10" pending={save.isPending}>
              {expense ? "Saqlash" : "Qo'shish"}
            </PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
