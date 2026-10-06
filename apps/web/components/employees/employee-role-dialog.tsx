"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ShieldIcon } from "lucide-react"
import Link from "next/link"
import { useId, useState } from "react"
import { toast } from "sonner"
import { ActionTooltip } from "@/components/action-tooltip"
import { PendingButton } from "@/components/pending-button"
import { Refusal } from "@/components/refusal"
import { SelectBox } from "@/components/select-field"
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
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { api, call } from "@/lib/api"
import { formatPhone } from "@/lib/phone"
import { employeesKey, rolesKey, useRoles } from "@/lib/queries"
import { settingsHref } from "@/components/settings/use-settings-tab"
import type { Member } from "@/lib/types"

// EmployeeRoleDialog is the owner's way to give an employee one of the
// company's roles, or to take it away ("Rolsiz": the default permissions).
// The employee works by the new role from their next request on
// (logic/roles.md, section 5).
export function EmployeeRoleDialog({ companyId, employee }: { companyId: number; employee: Member }) {
  const [open, setOpen] = useState(false)
  const current = employee.role_id === null ? "" : String(employee.role_id)
  const [roleId, setRoleId] = useState(current)
  const roles = useRoles(open ? companyId : null)
  const queryClient = useQueryClient()
  const id = useId()
  const name = employee.full_name ?? formatPhone(employee.phone)
  const save = useMutation({
    mutationFn: () =>
      call(
        api.PUT("/app/employees/{phone}/role", {
          params: { path: { phone: employee.phone } },
          body: { role_id: roleId === "" ? null : Number(roleId) },
        }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeesKey(companyId) })
      // The roles count who holds them.
      queryClient.invalidateQueries({ queryKey: rolesKey(companyId) })
      toast.success("Rol o'zgartirildi")
      setOpen(false)
    },
  })

  // Every opening starts from the role as it is now.
  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (next) {
      setRoleId(current)
      save.reset()
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <ActionTooltip label="Rolni o'zgartirish">
        <DialogTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground max-md:relative max-md:size-9 max-md:after:absolute max-md:after:-inset-1 pointer-coarse:relative pointer-coarse:size-9 pointer-coarse:after:absolute pointer-coarse:after:-inset-1"
              aria-label={`Rolni o'zgartirish: ${name}`}
            />
          }
        >
          <ShieldIcon />
        </DialogTrigger>
      </ActionTooltip>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rolni o&apos;zgartirish</DialogTitle>
          <DialogDescription>
            {employee.full_name ? `${employee.full_name} · ${formatPhone(employee.phone)}` : formatPhone(employee.phone)}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            save.mutate()
          }}
          noValidate
          className="space-y-4"
        >
          <Field>
            <FieldLabel htmlFor={id}>Rol</FieldLabel>
            <SelectBox
              id={id}
              value={roleId}
              onChange={setRoleId}
              empty="Rolsiz"
              options={(roles.data ?? []).map((role) => ({ value: String(role.id), label: role.name }))}
              disabled={roles.isPending}
            />
            <FieldDescription>Rolsiz xodim mijozlar va vazifalar bilan ishlaydi.</FieldDescription>
          </Field>
          {roles.data?.length === 0 && (
            <p className="text-[0.8125rem] leading-5 text-pretty text-muted-foreground">
              Hali rol yo&apos;q.{" "}
              <Link href={settingsHref("roles")} className="underline underline-offset-4 hover:text-foreground">
                Sozlamalarda rol yarating
              </Link>
            </p>
          )}
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
