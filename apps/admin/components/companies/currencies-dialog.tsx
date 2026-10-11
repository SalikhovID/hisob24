"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { PencilIcon } from "lucide-react"
import { useId, useState } from "react"
import { toast } from "sonner"
import { PendingButton } from "@/components/pending-button"
import { Refusal } from "@/components/refusal"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { api, call } from "@/lib/api"
import { keys, useCurrencies } from "@/lib/queries"
import type { CompanyDetail, Currency } from "@/lib/types"

// UZS is the so'm: every company's base currency, never turned off.
const UZS = 1

// CurrenciesDialog turns the currencies of the catalog on and off for the
// company (logic/currencies.md, section 3): the so'm is always on; a
// currency a live price is in stays on, which the API says.
export function CurrenciesDialog({ company }: { company: CompanyDetail }) {
  const [open, setOpen] = useState(false)
  const [chosen, setChosen] = useState<number[]>([])
  const queryClient = useQueryClient()
  const catalog = useCurrencies()
  const save = useMutation({
    mutationFn: (ids: number[]) =>
      call(api.PUT("/admin/companies/{id}/currencies", { params: { path: { id: company.id } }, body: { currency_ids: ids } })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.company(company.id) })
      toast.success("Valyutalar saqlandi")
      setOpen(false)
    },
  })

  // Every opening starts from the currencies as they are now.
  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (next) {
      setChosen(company.currencies.map((c) => c.id))
      save.reset()
    }
  }
  const toggle = (id: number, on: boolean) => setChosen((ids) => (on ? [...ids, id] : ids.filter((other) => other !== id)))

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger render={<Button variant="outline" size="lg" />}>
        <PencilIcon />
        O&apos;zgartirish
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Valyutalar</DialogTitle>
          <DialogDescription>
            Kompaniya hujjatlari va narxlari shu valyutalarda bo&apos;ladi. So&apos;m doim yoqilgan; ishlatilgan valyuta o&apos;chirilmaydi.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            save.mutate(chosen)
          }}
          noValidate
          className="space-y-4"
        >
          <ul aria-label="Katalog" className="space-y-3">
            {(catalog.data ?? []).map((c) => (
              <CurrencyChoice key={c.id} currency={c} checked={c.id === UZS || chosen.includes(c.id)} onChange={(on) => toggle(c.id, on)} />
            ))}
          </ul>
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

// CurrencyChoice is one currency of the catalog: a box to tick, named by
// the code and the name; the so'm is ticked and cannot be unticked.
function CurrencyChoice({ currency, checked, onChange }: { currency: Currency; checked: boolean; onChange: (on: boolean) => void }) {
  const id = useId()
  const fixed = currency.id === UZS
  return (
    <li className="flex items-center gap-3">
      <Checkbox id={id} checked={checked} disabled={fixed} onCheckedChange={(on) => onChange(on === true)} />
      <Label htmlFor={id} className="font-normal">
        {currency.code} — {currency.name}
        {fixed && <span className="text-muted-foreground"> (doim)</span>}
      </Label>
    </li>
  )
}
