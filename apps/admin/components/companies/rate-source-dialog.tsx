"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { PencilIcon } from "lucide-react"
import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { PendingButton } from "@/components/pending-button"
import { Refusal } from "@/components/refusal"
import { SelectField } from "@/components/select-field"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { FieldGroup } from "@/components/ui/field"
import { api, call } from "@/lib/api"
import { keys } from "@/lib/queries"
import { RATE_SOURCES, ROUNDINGS, roundingName } from "@/lib/rates"
import type { CompanyDetail, RateRounding, RateSourceCode } from "@/lib/types"

// Values is what the selects hold: the source and the step, as text.
interface Values {
  source: string
  rounding: string
}

const roundingOptions = ROUNDINGS.map((step) => ({ value: String(step), label: roundingName(step) }))

// RateSourceDialog sets where the night's run takes the company's rates and
// the step it rounds the dollar and the euro to (logic/currencies.md,
// section 4), from the next midnight. A company that enters its rates by
// hand has nothing to round: the step is turned off, and kept.
export function RateSourceDialog({ company }: { company: CompanyDetail }) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const current = (): Values => ({ source: company.rate_source, rounding: String(company.rate_rounding) })
  const form = useForm<Values>({ defaultValues: current() })
  const source = useWatch({ control: form.control, name: "source" })
  const save = useMutation({
    mutationFn: (values: Values) =>
      call(
        api.PUT("/admin/companies/{id}/rate-source", {
          params: { path: { id: company.id } },
          body: { source: values.source as RateSourceCode, rounding: Number(values.rounding) as RateRounding },
        }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.company(company.id) })
      toast.success("Kurs manbai saqlandi")
      setOpen(false)
    },
  })

  // Every opening starts from the company's source as it is now.
  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (next) {
      form.reset(current())
      save.reset()
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger render={<Button variant="outline" size="lg" aria-label="Kurs manbaini o'zgartirish" />}>
        <PencilIcon />
        O&apos;zgartirish
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Valyuta kurslari</DialogTitle>
          <DialogDescription>
            Har kuni 00:00 da (UTC+5) kurs shu manbadan olinadi. Bank javob bermasa — Markaziy bank, u ham bo&apos;lmasa kechagi kurs;
            «Qo&apos;lda» da kechagi kurs takrorlanadi.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((values) => save.mutate(values))} noValidate className="space-y-4">
          <FieldGroup>
            <SelectField control={form.control} name="source" label="Manba" options={RATE_SOURCES} />
            <SelectField control={form.control} name="rounding" label="Yaxlitlash" options={roundingOptions} disabled={source === "manual"} />
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
