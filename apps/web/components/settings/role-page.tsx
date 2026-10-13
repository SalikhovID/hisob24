"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Group, Row } from "@/components/kit/group"
import { BackLink, PageTitle } from "@/components/kit/page-title"
import { Failed, ListLoading, NotFound } from "@/components/states"
import { api, call } from "@/lib/api"
import { rolesKey, useRoles } from "@/lib/queries"
import { useOwner } from "@/lib/use-gate"
import { DeleteButton } from "./delete-button"
import { RoleForm } from "./role-form"

const back = { href: "/settings/roles", label: "Rollar" }

// holders says how many members hold a role.
export const holders = (count: number) => (count === 0 ? "Hech kimda" : `${count} ta xodim`)

// NewRolePage is the page of a role to be made, the owner's alone.
export function NewRolePage() {
  const owner = useOwner()
  if (!owner) return null
  return (
    <>
      <PageTitle title="Yangi rol" description="Nom va ruxsatlarni belgilang" back={back} />
      <RoleForm companyId={owner.company.id} />
    </>
  )
}

// RolePage is one role of the owner's company: its name and permissions,
// to be changed, and the way to delete it from a danger row under them (the
// API refuses while someone holds it).
export function RolePage({ id }: { id: number }) {
  const owner = useOwner()
  const companyId = owner ? owner.company.id : null
  const roles = useRoles(companyId)
  const queryClient = useQueryClient()
  const router = useRouter()
  const [removing, setRemoving] = useState(false)

  if (!owner) return null
  if (!roles.data) {
    return (
      <>
        <PageTitle title="Rol" back={back} />
        {roles.isPending && <ListLoading rows={3} mark="none" />}
        {roles.isError && <Failed error={roles.error} onRetry={() => roles.refetch()} />}
      </>
    )
  }
  const role = roles.data.find((candidate) => candidate.id === id)
  if (!role) {
    return (
      <>
        <BackLink {...back} />
        <NotFound title="Rol topilmadi" description="Bu rol o'chirilgan yoki sizning kompaniyangizniki emas." />
      </>
    )
  }

  return (
    <>
      <PageTitle title={role.name} description={`Rol · ${holders(role.members_count)}`} back={back} />
      {/* The form starts from the role as it is; a reload after a save starts from the saved one. */}
      <RoleForm key={`${role.id}:${role.name}:${role.permissions.join(",")}`} companyId={owner.company.id} role={role}>
        <Group>
          <Row variant="danger" onClick={() => setRemoving(true)} title="Rolni o'chirish" />
        </Group>
      </RoleForm>
      {removing && (
        <DeleteButton
          label={`O'chirish: ${role.name}`}
          title="Rolni o'chirasizmi?"
          description={`«${role.name}» roli o'chadi. Xodimga biriktirilgan rol o'chirilmaydi.`}
          done="Rol o'chirildi"
          onDelete={async () => {
            await call(api.DELETE("/app/roles/{id}", { params: { path: { id: role.id } } }))
            await queryClient.invalidateQueries({ queryKey: rolesKey(companyId) })
          }}
          onDone={() => router.push(back.href)}
          open
          onOpenChange={(open) => !open && setRemoving(false)}
        />
      )}
    </>
  )
}
