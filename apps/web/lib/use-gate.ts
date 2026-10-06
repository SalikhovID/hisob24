import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { can } from "./permissions"
import { useMe } from "./queries"
import type { AppCompany, Me, Permission } from "./types"

// Gate is what a gated page works with: the session's company and user, and
// what the member may do there.
export interface Gate {
  company: AppCompany
  user: Me["user"]
  permissions: Permission[]
}

// useGate is the gate of a page that is for some members only
// (logic/roles.md, section 8): it gives the session once it is known to be
// let in, and null until then. Anyone else is sent home: the menu shows them
// no way to such a page, and the API would refuse them all the same. A
// session with no company chosen yet is nobody's to let in or send away:
// the shell takes it to the company list.
export function useGate(allowed: (me: Me) => boolean): Gate | null {
  const router = useRouter()
  const me = useMe()
  const data = me.data
  const company = data?.company ?? null
  const known = data !== undefined && company !== null
  const ok = known && allowed(data)
  const stranger = known && !ok

  useEffect(() => {
    if (stranger) router.replace("/")
  }, [stranger, router])

  if (!ok || !data || !company) return null
  return { company, user: data.user, permissions: data.permissions }
}

// useOwner is the gate of the pages that are the company owner's alone: the
// roles (logic/roles.md, section 5).
export function useOwner(): Gate | null {
  return useGate((me) => me.company?.role === "owner")
}

// usePermission is the gate of a page that takes a permission: the owner has
// them all, an employee what their role, or the default, allows.
export function usePermission(permission: Permission): Gate | null {
  return useGate((me) => can(me.permissions, permission))
}
