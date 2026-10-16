"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { CheckIcon, MapPinIcon, TriangleAlertIcon } from "lucide-react"
import { type FormEvent, useId, useState } from "react"
import { toast } from "sonner"
import { Foot, Group } from "@/components/kit/group"
import { MainButton } from "@/components/kit/main-button"
import { SheetForm } from "@/components/kit/sheet-form"
import { TileIcon } from "@/components/kit/tile-icon"
import { Refusal } from "@/components/refusal"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { api, call } from "@/lib/api"
import { employeesKey, membersKey, useAssignedCounts } from "@/lib/queries"
import type { Member } from "@/lib/types"
import { useLocation } from "@/lib/use-location"
import { cn } from "@/lib/utils"

// EmployeeLocationsSheet is the owner's way to restrict an employee to some
// of the company's locations, or to let them work in every one again
// (logic/locations.md, section 5), as the prototype's sheet: «Barcha
// lokatsiyalar» a switch, the locations rows to choose (turned off from
// every one, every location is still chosen: the ones to leave out are
// taken away). The employee works by it from their next request on; the
// tasks they are assigned elsewhere stay theirs, and the sheet says how
// many there are. The employee's sheet opens it.
export function EmployeeLocationsSheet({
  companyId,
  employee,
  open,
  onOpenChange,
}: {
  companyId: number
  employee: Member
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { locations } = useLocation()
  const [all, setAll] = useState(employee.locations === null)
  // The locations chosen; null until one is taken away: every one.
  const [ids, setIds] = useState<number[] | null>(employee.locations?.map((l) => l.id) ?? null)
  const [refusal, setRefusal] = useState<string | null>(null)
  const switchId = useId()
  const queryClient = useQueryClient()
  const chosen = all || ids === null ? locations.map((l) => l.id) : ids
  // How many tasks the employee is assigned in each location, asked only while the sheet is open.
  const counts = useAssignedCounts(open ? companyId : null, employee.phone, locations)
  const elsewhere = locations.filter((l) => !chosen.includes(l.id)).reduce((n, l) => n + (counts[l.id] ?? 0), 0)
  const save = useMutation({
    mutationFn: () =>
      call(
        api.PUT("/app/employees/{phone}/locations", {
          params: { path: { phone: employee.phone } },
          body: { location_ids: all ? null : chosen },
        }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeesKey(companyId) })
      // The members tell their locations too: a task's assignee is chosen among them.
      queryClient.invalidateQueries({ queryKey: membersKey(companyId) })
      toast.success("Lokatsiyalar o'zgartirildi")
      onOpenChange(false)
    },
  })

  const toggle = (locationId: number) => {
    setIds(chosen.includes(locationId) ? chosen.filter((id) => id !== locationId) : [...chosen, locationId])
    setRefusal(null)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    // At least one location, in the API's words, before anything is sent.
    if (!all && chosen.length === 0) {
      setRefusal("Kamida bitta lokatsiyani tanlang")
      return
    }
    save.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lokatsiyalarni o&apos;zgartirish</DialogTitle>
          <DialogDescription>Xodim faqat belgilangan lokatsiyalarning vazifalarini ko&apos;radi va qo&apos;shadi.</DialogDescription>
        </DialogHeader>
        <SheetForm onSubmit={submit}>
          {save.isError && <Refusal className="mb-4">{save.error.message}</Refusal>}
          <Group>
            <div data-slot="form-row" className="flex min-h-12 items-center gap-3 px-4 py-1.5">
              <label htmlFor={switchId} className="min-w-0 flex-1 text-base">
                Barcha lokatsiyalar
              </label>
              <Switch id={switchId} checked={all} onCheckedChange={(checked) => setAll(checked)} />
            </div>
          </Group>
          <Group inset="tile" className={cn(all && "opacity-50")}>
            {locations.map((location) => {
              const on = chosen.includes(location.id)
              return (
                <button
                  key={location.id}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  disabled={all}
                  onClick={() => toggle(location.id)}
                  data-slot="row"
                  className="flex min-h-12 w-full items-center gap-3 px-4 py-1.5 text-left text-base outline-none active:bg-press focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
                >
                  <TileIcon icon={MapPinIcon} />
                  <span className="min-w-0 flex-1 truncate">{location.name}</span>
                  {on && <CheckIcon aria-hidden="true" strokeWidth={2.6} className="size-5 shrink-0 text-primary" />}
                </button>
              )
            })}
          </Group>
          {refusal && (
            <Foot className="-mt-4 text-destructive">
              <span role="alert">{refusal}</span>
            </Foot>
          )}
          {elsewhere > 0 && (
            <p role="status" className="flex items-start gap-2.5 rounded-group bg-warning-soft px-4 py-3 text-md text-warning">
              <TriangleAlertIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
              Boshqa lokatsiyalarda {elsewhere} ta vazifaga mas&apos;ul. Saqlash baribir mumkin.
            </p>
          )}
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
