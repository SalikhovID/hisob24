"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { PencilIcon, PowerIcon, Trash2Icon, WalletIcon } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"
import { ActionTooltip } from "@/components/action-tooltip"
import { PendingButton } from "@/components/pending-button"
import { Refusal } from "@/components/refusal"
import { SelectField } from "@/components/select-field"
import { TextField } from "@/components/text-field"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { FieldGroup } from "@/components/ui/field"
import { api, call } from "@/lib/api"
import { keys } from "@/lib/queries"
import { accountSchema } from "@/lib/schemas"
import type { BankAccount, CompanyDetail } from "@/lib/types"

type Input = z.input<typeof accountSchema>
type Output = z.output<typeof accountSchema>

// An icon button of an account's row: quiet until the pointer is on it,
// with a larger target under a thumb.
const rowButton =
  "text-muted-foreground hover:text-foreground max-md:relative max-md:size-9 max-md:after:absolute max-md:after:-inset-1 pointer-coarse:relative pointer-coarse:size-9 pointer-coarse:after:absolute pointer-coarse:after:-inset-1"

// currencyOptions offers the currencies the company has on, by code and name.
const currencyOptions = (company: CompanyDetail) => company.currencies.map((c) => ({ value: String(c.id), label: `${c.code} — ${c.name}` }))

// AddAccountDialog adds an account (cash, a bank account, a card) to the
// company, in one of its currencies (logic/finance.md, section 3).
export function AddAccountDialog({ company }: { company: CompanyDetail }) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const form = useForm<Input, unknown, Output>({ resolver: zodResolver(accountSchema), defaultValues: { name: "", currency_id: "1" } })
  const add = useMutation({
    mutationFn: (account: Output) => call(api.POST("/admin/companies/{id}/accounts", { params: { path: { id: company.id } }, body: account })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.company(company.id) })
      toast.success("Akkaunt qo'shildi")
      setOpen(false)
    },
  })

  // Every opening starts from an empty form, in so'm.
  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (next) {
      form.reset({ name: "", currency_id: "1" })
      add.reset()
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger render={<Button variant="outline" size="lg" />}>
        <WalletIcon />
        Akkaunt qo&apos;shish
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Akkaunt qo&apos;shish</DialogTitle>
          <DialogDescription>Kassa, bank hisobi yoki karta: puli turadigan joy, bitta valyutada.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((account) => add.mutate(account))} noValidate className="space-y-4">
          <FieldGroup>
            <TextField control={form.control} name="name" label="Nomi" autoComplete="off" />
            <SelectField control={form.control} name="currency_id" label="Valyuta" options={currencyOptions(company)} />
          </FieldGroup>
          {add.isError && <Refusal>{add.error.message}</Refusal>}
          <DialogFooter>
            <PendingButton type="submit" size="lg" className="px-3.5 max-sm:h-10" pending={add.isPending}>
              Qo&apos;shish
            </PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// EditAccountDialog changes an account's name and currency.
export function EditAccountDialog({ company, account }: { company: CompanyDetail; account: BankAccount }) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const current = () => ({ name: account.name, currency_id: String(account.currency_id) })
  const form = useForm<Input, unknown, Output>({ resolver: zodResolver(accountSchema), defaultValues: current() })
  const save = useMutation({
    mutationFn: (change: Output) =>
      call(api.PATCH("/admin/companies/{id}/accounts/{accountId}", { params: { path: { id: company.id, accountId: account.id } }, body: change })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.company(company.id) })
      toast.success("Akkaunt saqlandi")
      setOpen(false)
    },
  })

  // Every opening starts from the account as it is now.
  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (next) {
      form.reset(current())
      save.reset()
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <ActionTooltip label="Tahrirlash">
        <DialogTrigger render={<Button variant="ghost" size="icon" className={rowButton} aria-label={`Tahrirlash: ${account.name}`} />}>
          <PencilIcon />
        </DialogTrigger>
      </ActionTooltip>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Akkauntni tahrirlash</DialogTitle>
          <DialogDescription>Hujjati bor akkauntning valyutasi o&apos;zgarmaydi.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((change) => save.mutate(change))} noValidate className="space-y-4">
          <FieldGroup>
            <TextField control={form.control} name="name" label="Nomi" autoComplete="off" />
            <SelectField control={form.control} name="currency_id" label="Valyuta" options={currencyOptions(company)} />
          </FieldGroup>
          {save.isError && <Refusal>{save.error.message}</Refusal>}
          <DialogFooter>
            <PendingButton type="submit" size="lg" className="px-3.5 max-sm:h-10" pending={save.isPending}>
              Saqlash
            </PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ToggleAccountButton turns an account off (offered to no new document)
// or on again. The API keeps the last active one on: its reason shows.
export function ToggleAccountButton({ companyId, account }: { companyId: number; account: BankAccount }) {
  const queryClient = useQueryClient()
  const label = account.is_active ? "Nofaol qilish" : "Faollashtirish"
  const toggle = useMutation({
    mutationFn: () =>
      call(
        api.PATCH("/admin/companies/{id}/accounts/{accountId}", {
          params: { path: { id: companyId, accountId: account.id } },
          body: { is_active: !account.is_active },
        }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.company(companyId) })
      toast.success(account.is_active ? "Akkaunt nofaol qilindi" : "Akkaunt faollashtirildi")
    },
    onError: (error) => toast.error(error.message),
  })
  return (
    <ActionTooltip label={label}>
      <Button variant="ghost" size="icon" className={rowButton} aria-label={`${label}: ${account.name}`} disabled={toggle.isPending} onClick={() => toggle.mutate()}>
        <PowerIcon />
      </Button>
    </ActionTooltip>
  )
}

// DeleteAccountButton hides an account after asking. The API refuses the
// last active one and one a document names: its reason shows.
export function DeleteAccountButton({ companyId, account }: { companyId: number; account: BankAccount }) {
  const [confirming, setConfirming] = useState(false)
  const queryClient = useQueryClient()
  const remove = useMutation({
    mutationFn: () => call(api.DELETE("/admin/companies/{id}/accounts/{accountId}", { params: { path: { id: companyId, accountId: account.id } } })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.company(companyId) })
      toast.success("Akkaunt o'chirildi")
    },
    onError: (error) => toast.error(error.message),
    onSettled: () => setConfirming(false),
  })

  return (
    <AlertDialog open={confirming} onOpenChange={setConfirming}>
      <ActionTooltip label="O'chirish">
        <AlertDialogTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20 max-md:relative max-md:size-9 max-md:after:absolute max-md:after:-inset-1 pointer-coarse:relative pointer-coarse:size-9 pointer-coarse:after:absolute pointer-coarse:after:-inset-1"
              aria-label={`O'chirish: ${account.name}`}
            />
          }
        >
          <Trash2Icon />
        </AlertDialogTrigger>
      </ActionTooltip>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Akkauntni o&apos;chirasizmi?</AlertDialogTitle>
          <AlertDialogDescription>
            «{account.name}» akkaunti o&apos;chadi. Hujjati bor yoki yagona faol akkaunt o&apos;chirilmaydi: uni nofaol qilish mumkin.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel size="lg" className="max-sm:h-10">
            Bekor qilish
          </AlertDialogCancel>
          <PendingButton variant="destructive" size="lg" className="max-sm:h-10" pending={remove.isPending} onClick={() => remove.mutate()}>
            O&apos;chirish
          </PendingButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
