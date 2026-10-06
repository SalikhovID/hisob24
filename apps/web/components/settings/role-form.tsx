"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useId } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { PendingButton } from "@/components/pending-button"
import { Refusal } from "@/components/refusal"
import { TextField } from "@/components/text-field"
import { Checkbox } from "@/components/ui/checkbox"
import { FieldGroup } from "@/components/ui/field"
import { api, call } from "@/lib/api"
import { actionLabels, actions, actionsOf, permissionOf, sectionLabels, sections, toggled } from "@/lib/permissions"
import { rolesKey } from "@/lib/queries"
import { roleSchema } from "@/lib/schemas"
import type { CompanyRole, Permission } from "@/lib/types"
import { cn } from "@/lib/utils"
import { settingsHref } from "./use-settings-tab"

type RoleInput = { name: string; permissions: Permission[] }

// The matrix is a table from the md breakpoint up (a row per section, a
// column per action, the header saying the actions) and a list of groups
// below it (a section's name over its actions, each with its own label).
const columns = "md:grid md:grid-cols-[minmax(8rem,1fr)_repeat(5,minmax(5.5rem,auto))] md:items-center md:gap-x-4"

// RoleForm is a role's name and its permissions (logic/roles.md, section
// 5): a new role (no role) or one being changed. Saving makes or replaces it
// and opens the roles tab; a refusal (a name taken) shows the API's reason.
export function RoleForm({ companyId, role }: { companyId: number; role?: CompanyRole }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const form = useForm<RoleInput>({
    resolver: zodResolver(roleSchema),
    defaultValues: { name: role?.name ?? "", permissions: role?.permissions ?? [] },
  })
  const save = useMutation({
    mutationFn: (input: RoleInput) =>
      role
        ? call(api.PUT("/app/roles/{id}", { params: { path: { id: role.id } }, body: input }))
        : call(api.POST("/app/roles", { body: input })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rolesKey(companyId) })
      toast.success(role ? "Rol saqlandi" : "Rol yaratildi")
      router.push(settingsHref("roles"))
    },
  })

  return (
    <form onSubmit={form.handleSubmit((input) => save.mutate(input))} noValidate className="space-y-6">
      <FieldGroup className="max-w-lg">
        <TextField control={form.control} name="name" label="Rol nomi" autoComplete="off" />
      </FieldGroup>
      <Controller
        control={form.control}
        name="permissions"
        render={({ field }) => <PermissionMatrix value={field.value} onChange={field.onChange} />}
      />
      {save.isError && <Refusal>{save.error.message}</Refusal>}
      <PendingButton type="submit" size="lg" className="px-3.5 max-sm:w-full" pending={save.isPending}>
        {role ? "Saqlash" : "Yaratish"}
      </PendingButton>
    </form>
  )
}

// PermissionMatrix is the permissions as checkboxes, a group per section.
// Ticking an action ticks the section's view too; unticking the view clears
// the section.
function PermissionMatrix({ value, onChange }: { value: Permission[]; onChange: (next: Permission[]) => void }) {
  const id = useId()
  return (
    <div role="group" aria-label="Ruxsatlar" className="divide-y rounded-xl border bg-card">
      <div aria-hidden="true" className={cn("hidden px-4 py-2 text-[0.8125rem] leading-5 text-muted-foreground", columns)}>
        <span>Bo&apos;lim</span>
        {actions.map((action) => (
          <span key={action}>{actionLabels[action]}</span>
        ))}
      </div>
      {sections.map((section) => (
        <div key={section} role="group" aria-label={sectionLabels[section]} className={cn("px-4 py-3", columns)}>
          <span className="block text-sm font-medium max-md:mb-2">{sectionLabels[section]}</span>
          {actions.map((action) => {
            if (!actionsOf(section).includes(action)) return <span key={action} aria-hidden="true" className="hidden md:block" />
            const permission = permissionOf(section, action)
            const boxId = `${id}-${permission}`
            return (
              <span key={action} className="inline-flex items-center gap-2 max-md:mr-4 max-md:mb-1">
                <Checkbox
                  id={boxId}
                  checked={value.includes(permission)}
                  onCheckedChange={(checked) => onChange(toggled(value, permission, checked === true))}
                />
                <label htmlFor={boxId} className="text-sm md:sr-only">
                  {actionLabels[action]}
                </label>
              </span>
            )
          })}
        </div>
      ))}
    </div>
  )
}
