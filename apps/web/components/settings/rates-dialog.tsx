"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { AmountRow } from "@/components/kit/form-row"
import { Group } from "@/components/kit/group"
import { MainButton } from "@/components/kit/main-button"
import { SheetForm } from "@/components/kit/sheet-form"
import { Refusal } from "@/components/refusal"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
// converted by (logic/currencies.md, section 4), as the prototype's sheet: a
// row a currency, «1 USD» beside what it is worth in so'm. It is opened from
// outside (the page's plus).
export function RatesDialog({
  companyId,
  currencies,
  open,
  onOpenChange,
}: {
  companyId: number
  currencies: CompanyCurrency[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
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
      onOpenChange(false)
    },
  })


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kurslarni yangilash</DialogTitle>
          <DialogDescription>Bir birlik necha so&apos;m. Avvalgi hujjatlar o&apos;z kursida qoladi.</DialogDescription>
        </DialogHeader>
        <SheetForm onSubmit={form.handleSubmit((rates) => save.mutate(rates))}>
          {save.isError && <Refusal className="mb-4">{save.error.message}</Refusal>}
          <Group>
            {currencies.map((c) => (
              <AmountRow key={c.id} control={form.control} name={codeOf(c)} label={`1 ${c.code}`} />
            ))}
          </Group>
          <DialogFooter>
            <MainButton type="submit" pending={save.isPending}>
              Saqlash
            </MainButton>
          </DialogFooter>
        </SheetForm>
      </DialogContent>
    </Dialog>
  )
}
