"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { CalendarPlusIcon } from "lucide-react"
import { useId, useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"
import { PendingButton } from "@/components/pending-button"
import { Refusal } from "@/components/refusal"
import { TextField } from "@/components/text-field"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { api, call } from "@/lib/api"
import { previewEndDate } from "@/lib/billing"
import { formatDate } from "@/lib/format"
import { keys } from "@/lib/queries"
import { billingSchema } from "@/lib/schemas"
import type { Company } from "@/lib/types"

type Input = z.input<typeof billingSchema>
type Output = z.output<typeof billingSchema>

const empty: Input = { days: "", amount: "", note: "" }

// AddBillingDialog pays for more days, showing the end date it will give
// before the payment is made.
export function AddBillingDialog({ company }: { company: Company }) {
  const [open, setOpen] = useState(false)
  const noteId = useId()
  const queryClient = useQueryClient()
  const form = useForm<Input, unknown, Output>({ resolver: zodResolver(billingSchema), defaultValues: empty })
  const days = useWatch({ control: form.control, name: "days" })
  const dayCount = /^\d+$/.test(days.trim()) ? Number(days) : 0
  const preview =
    dayCount >= 1 && dayCount <= 3650
      ? formatDate(previewEndDate(company.end_date, company.days_left, dayCount))
      : null
  const add = useMutation({
    mutationFn: (payment: Output) =>
      call(api.POST("/admin/companies/{id}/billings", { params: { path: { id: company.id } }, body: payment })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.company(company.id) })
      queryClient.invalidateQueries({ queryKey: keys.billings(company.id) })
      queryClient.invalidateQueries({ queryKey: keys.companies() })
      toast.success("To'lov qo'shildi")
      setOpen(false)
    },
  })

  // Every opening starts from an empty form.
  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (next) {
      form.reset(empty)
      add.reset()
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger render={<Button size="lg" className="px-3.5" />}>
        <CalendarPlusIcon />
        Billing qo&apos;shish
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Billing qo&apos;shish</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((payment) => add.mutate(payment))} noValidate className="space-y-4">
          <FieldGroup>
            {/* The day count and what it leads to read as one: the line stands close under the field. */}
            <div className="grid gap-2">
              <TextField
                control={form.control}
                name="days"
                label="Kunlar soni"
                inputMode="numeric"
                autoComplete="off"
              />
              <p
                aria-live="polite"
                aria-atomic="true"
                className="flex items-baseline justify-between gap-3 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground tabular-nums"
              >
                Yangi tugash sanasi:{" "}
                {preview ? (
                  <strong className="font-semibold text-foreground">{preview}</strong>
                ) : (
                  <strong className="font-normal">—</strong>
                )}
              </p>
            </div>
            <TextField
              control={form.control}
              name="amount"
              label="Summa"
              inputMode="decimal"
              placeholder="150000"
              autoComplete="off"
            />
            <Controller
              control={form.control}
              name="note"
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor={noteId}>Izoh</FieldLabel>
                  <Textarea id={noteId} rows={2} {...field} />
                </Field>
              )}
            />
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
