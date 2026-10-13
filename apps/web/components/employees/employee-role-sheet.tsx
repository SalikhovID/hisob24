"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { toast } from "sonner"
import { PickerSheet } from "@/components/kit/picker-sheet"
import { settingsHref } from "@/components/settings/use-settings-tab"
import { api, call } from "@/lib/api"
import { summaryOf } from "@/lib/permissions"
import { employeesKey, rolesKey, useRoles } from "@/lib/queries"
import type { Member } from "@/lib/types"

// EmployeeRoleSheet is the owner's way to give an employee one of the
// company's roles, or to take it away («Rolsiz»: the default permissions),
// as the prototype's picker: the roles each with the sections it opens; a
// press saves it (the role held already asks nothing). The employee works
// by the new role from their next request on (logic/roles.md, section 5).
// The employee's sheet opens it.
export function EmployeeRoleSheet({
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
  const roles = useRoles(open ? companyId : null)
  const queryClient = useQueryClient()
  const current = employee.role_id === null ? "" : String(employee.role_id)
  const save = useMutation({
    mutationFn: (roleId: number | null) =>
      call(api.PUT("/app/employees/{phone}/role", { params: { path: { phone: employee.phone } }, body: { role_id: roleId } })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeesKey(companyId) })
      // The roles count who holds them.
      queryClient.invalidateQueries({ queryKey: rolesKey(companyId) })
      toast.success("Rol o'zgartirildi")
    },
    onError: (error) => toast.error(error.message),
  })

  return (
    <PickerSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Rolni o'zgartirish"
      options={(roles.data ?? []).map((role) => ({ value: String(role.id), label: role.name, sub: summaryOf(role.permissions) }))}
      value={current}
      none="Rolsiz"
      onChange={(value) => {
        if (value !== current) save.mutate(value === "" ? null : Number(value))
      }}
      note={
        roles.data?.length === 0 ? (
          <>
            Hali rol yo&apos;q.{" "}
            <Link href={settingsHref("roles")} className="font-medium text-primary">
              Sozlamalarda rol yarating
            </Link>
          </>
        ) : (
          "Rolsiz xodim mijozlar va vazifalar bilan ishlaydi."
        )
      }
    />
  )
}
