"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { MapPinIcon } from "lucide-react"
import { type FormEvent, useId, useState } from "react"
import { toast } from "sonner"
import { ActionTooltip } from "@/components/action-tooltip"
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
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { api, call } from "@/lib/api"
import { formatPhone } from "@/lib/phone"
import { employeesKey, membersKey, useAssignedCounts } from "@/lib/queries"
import type { Location, Member } from "@/lib/types"

// EmployeeLocationsDialog is the owner's way to restrict an employee to
// some of the company's locations, or to let them work in every one again
// (logic/locations.md, section 5). The employee works by it from their
// next request on; the tasks they are assigned elsewhere stay theirs, and
// the dialog says how many there are.
export function EmployeeLocationsDialog({ companyId, employee, locations }: { companyId: number; employee: Member; locations: Location[] }) {
  const [open, setOpen] = useState(false)
  const [all, setAll] = useState(employee.locations === null)
  const [chosen, setChosen] = useState<Set<number>>(() => new Set(employee.locations?.map((l) => l.id) ?? []))
  const [refusal, setRefusal] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const id = useId()
  const name = employee.full_name ?? formatPhone(employee.phone)
  // How many tasks the employee is assigned in each location, asked only
  // while the dialog is open.
  const counts = useAssignedCounts(open ? companyId : null, employee.phone, locations)
  const elsewhere = all ? 0 : locations.filter((l) => !chosen.has(l.id)).reduce((n, l) => n + (counts[l.id] ?? 0), 0)
  const save = useMutation({
    mutationFn: () =>
      call(
        api.PUT("/app/employees/{phone}/locations", {
          params: { path: { phone: employee.phone } },
          body: { location_ids: all ? null : [...chosen] },
        }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeesKey(companyId) })
      // The members tell their locations too: a task's assignee is chosen among them.
      queryClient.invalidateQueries({ queryKey: membersKey(companyId) })
      toast.success("Lokatsiyalar o'zgartirildi")
      setOpen(false)
    },
  })

  // Every opening starts from the restriction as it is now.
  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (next) {
      setAll(employee.locations === null)
      setChosen(new Set(employee.locations?.map((l) => l.id) ?? []))
      setRefusal(null)
      save.reset()
    }
  }

  const toggle = (locationId: number, checked: boolean) => {
    setChosen((was) => {
      const next = new Set(was)
      if (checked) next.add(locationId)
      else next.delete(locationId)
      return next
    })
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    // At least one location, in the API's words, before anything is sent.
    if (!all && chosen.size === 0) {
      setRefusal("Kamida bitta lokatsiyani tanlang")
      return
    }
    setRefusal(null)
    save.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <ActionTooltip label="Lokatsiyalarni o'zgartirish">
        <DialogTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground max-md:relative max-md:size-9 max-md:after:absolute max-md:after:-inset-1 pointer-coarse:relative pointer-coarse:size-9 pointer-coarse:after:absolute pointer-coarse:after:-inset-1"
              aria-label={`Lokatsiyalarni o'zgartirish: ${name}`}
            />
          }
        >
          <MapPinIcon />
        </DialogTrigger>
      </ActionTooltip>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lokatsiyalarni o&apos;zgartirish</DialogTitle>
          <DialogDescription>
            {employee.full_name ? `${employee.full_name} · ${formatPhone(employee.phone)}` : formatPhone(employee.phone)}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4">
          <Field orientation="horizontal">
            <Checkbox id={`${id}-all`} checked={all} onCheckedChange={(checked) => setAll(checked === true)} />
            <FieldLabel htmlFor={`${id}-all`} className="font-normal">
              Barcha lokatsiyalar
            </FieldLabel>
          </Field>
          {/* The locations to choose among, while not every one is chosen. */}
          <div role="group" aria-label="Lokatsiyalar" className="space-y-3 rounded-lg border bg-muted/40 px-3 py-2.5">
            {locations.map((location) => (
              <Field key={location.id} orientation="horizontal">
                <Checkbox
                  id={`${id}-${location.id}`}
                  checked={all || chosen.has(location.id)}
                  disabled={all}
                  onCheckedChange={(checked) => toggle(location.id, checked === true)}
                />
                <FieldLabel htmlFor={`${id}-${location.id}`} className="font-normal">
                  {location.name}
                </FieldLabel>
              </Field>
            ))}
          </div>
          <FieldDescription>Xodim faqat belgilangan lokatsiyalarning vazifalarini ko&apos;radi va qo&apos;shadi.</FieldDescription>
          {elsewhere > 0 && (
            <p role="status" className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
              Boshqa lokatsiyalarda {elsewhere} ta vazifaga mas&apos;ul
            </p>
          )}
          {refusal && <Refusal>{refusal}</Refusal>}
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
