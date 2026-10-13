"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { type ReactNode, useId } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { TextRow } from "@/components/kit/form-row"
import { Foot, Group, SectionHeading } from "@/components/kit/group"
import { MainBar, MainButton } from "@/components/kit/main-button"
import { Refusal } from "@/components/refusal"
import { Switch } from "@/components/ui/switch"
import { api, call } from "@/lib/api"
import { actionLabels, actionsOf, permissionOf, sectionLabels, sections, toggled } from "@/lib/permissions"
import { rolesKey } from "@/lib/queries"
import { roleSchema } from "@/lib/schemas"
import type { CompanyRole, Permission } from "@/lib/types"

type RoleInput = { name: string; permissions: Permission[] }

// RoleForm is a role's name and its permissions (logic/roles.md, section
// 5), a new role (no role) or one being changed, as the prototype's form:
// the name a row; each section under its heading (how many it holds beside
// it) with its actions as switches; the main button in the bar at the
// bottom. Saving makes or replaces it and opens the roles; a refusal (a name
// taken) shows the API's reason. children stand between the matrix and the
// bar (the way to delete a role being changed).
export function RoleForm({ companyId, role, children }: { companyId: number; role?: CompanyRole; children?: ReactNode }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const form = useForm<RoleInput>({
    resolver: zodResolver(roleSchema),
    defaultValues: { name: role?.name ?? "", permissions: role?.permissions ?? [] },
  })
  const save = useMutation({
    mutationFn: (input: RoleInput) =>
      role ? call(api.PUT("/app/roles/{id}", { params: { path: { id: role.id } }, body: input })) : call(api.POST("/app/roles", { body: input })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rolesKey(companyId) })
      toast.success(role ? "Rol saqlandi" : "Rol yaratildi")
      router.push("/settings/roles")
    },
  })

  return (
    <form onSubmit={form.handleSubmit((input) => save.mutate(input))} noValidate>
      {save.isError && <Refusal className="mb-4">{save.error.message}</Refusal>}
      <Group>
        <TextRow control={form.control} name="name" label="Rol nomi" placeholder="Masalan, Sotuvchi" autoComplete="off" />
      </Group>
      <Controller control={form.control} name="permissions" render={({ field }) => <PermissionMatrix value={field.value} onChange={field.onChange} />} />
      <Foot className="-mt-4">Amal yoqilsa «Ko&apos;rish» o&apos;zi yoqiladi. «Ko&apos;rish» o&apos;chirilsa, bo&apos;limning hamma amali tozalanadi.</Foot>
      {children}
      <MainBar>
        <MainButton type="submit" pending={save.isPending}>
          {role ? "Saqlash" : "Yaratish"}
        </MainButton>
      </MainBar>
    </form>
  )
}

// PermissionMatrix is the permissions as switches, a group per section
// under its heading. Turning an action on turns the section's view on too;
// turning the view off clears the section.
function PermissionMatrix({ value, onChange }: { value: Permission[]; onChange: (next: Permission[]) => void }) {
  const id = useId()
  return (
    <>
      {sections.map((section) => {
        const held = actionsOf(section).filter((action) => value.includes(permissionOf(section, action))).length
        return (
          <div key={section}>
            <SectionHeading hint={held > 0 ? `${held} ta` : undefined}>{sectionLabels[section]}</SectionHeading>
            <div role="group" aria-label={sectionLabels[section]}>
              <Group>
                {actionsOf(section).map((action) => {
                  const permission = permissionOf(section, action)
                  const switchId = `${id}-${permission}`
                  return (
                    <div key={action} data-slot="row" className="flex min-h-12 items-center gap-3 px-4 py-1.5">
                      <label htmlFor={switchId} className="min-w-0 flex-1 text-base">
                        {actionLabels[action]}
                      </label>
                      <Switch id={switchId} checked={value.includes(permission)} onCheckedChange={(checked) => onChange(toggled(value, permission, checked))} />
                    </div>
                  )
                })}
              </Group>
            </div>
          </div>
        )
      })}
    </>
  )
}
