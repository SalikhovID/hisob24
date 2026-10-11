"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { PencilIcon } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { PendingButton } from "@/components/pending-button"
import { Refusal } from "@/components/refusal"
import { TextField } from "@/components/text-field"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { FieldGroup } from "@/components/ui/field"
import { api, call } from "@/lib/api"
import { formatRate } from "@/lib/format"
import { meKey, ratesKey } from "@/lib/queries"
import type { CompanyCurrency } from "@/lib/types"

// rate reads a rate as typed ("12 800,5"): the spaces out and the comma a
// dot, then checked as the API checks it (so'm per unit, four decimals,
// above zero).
const rate = z.string().transform((value, context) => {
  const text = value.replace(/\s/g, "").replace(",", ".")
  if (text === "") {
    context.addIssue({ code: "custom", message: "Kursni kiriting" })
    return z.NEVER
  }
  if (!/^\d{1,10}(\.\d{1,4})?$/.test(text) || Number(text) === 0) {
    context.addIssue({ code: "custom", message: "Kurs noto'g'ri" })
    return z.NEVER
  }
  return text
})

// ratesSchema checks the dialog: a rate for each currency the company has
// on (the others are not asked and not sent).
const ratesSchema = z.object({ usd: rate.optional(), eur: rate.optional(), rub: rate.optional() })

type Code = "usd" | "eur" | "rub"
type RatesForm = Partial<Record<Code, string>>
type RatesOutput = z.output<typeof ratesSchema>

// codeOf is the key a currency's rate goes under: its code in lower case.
const codeOf = (c: CompanyCurrency) => c.code.toLowerCase() as Code

// typed is a stored rate as it is typed back: without the thousands and
// the trailing zeros ("12800", "12800,5"); nothing while none was set.
const typed = (c: CompanyCurrency) => (c.rate === null ? "" : formatRate(c.rate).replace(/ /g, ""))

// RatesDialog enters the rates of the currencies given (the company's, but
// the so'm) as a new standard row: what the documents from now on are
// converted by (logic/currencies.md, section 4).
export function RatesDialog({ companyId, currencies }: { companyId: number; currencies: CompanyCurrency[] }) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const defaults = (): RatesForm => Object.fromEntries(currencies.map((c) => [codeOf(c), typed(c)]))
  const form = useForm<RatesForm, unknown, RatesOutput>({ resolver: zodResolver(ratesSchema), defaultValues: defaults() })
  const save = useMutation({
    mutationFn: (rates: RatesOutput) => call(api.POST("/app/currency-rates", { body: rates })),
    onSuccess: () => {
      // The rates in force (what /app/me tells) and the history both change.
      queryClient.invalidateQueries({ queryKey: meKey })
      queryClient.invalidateQueries({ queryKey: ratesKey(companyId) })
      toast.success("Kurslar saqlandi")
      setOpen(false)
    },
  })

  // Every opening starts from the rates as they are now.
  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (next) {
      form.reset(defaults())
      save.reset()
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger render={<Button variant="outline" size="lg" className="px-3.5" />}>
        <PencilIcon />
        Kurslarni yangilash
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Kurslarni yangilash</DialogTitle>
          <DialogDescription>Bir birlik necha so&apos;m. Avvalgi hujjatlar o&apos;z kursida qoladi.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((rates) => save.mutate(rates))} noValidate className="space-y-4">
          <FieldGroup>
            {currencies.map((c) => (
              <TextField key={c.id} control={form.control} name={codeOf(c)} label={`1 ${c.code} = ? so'm`} inputMode="decimal" autoComplete="off" />
            ))}
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
