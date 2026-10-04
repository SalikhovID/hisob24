import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useMe } from "./queries"

// useOwner is the gate of the pages that are the company owner's alone
// (logic/roles.md): it gives the session's company and user once the session
// is known to be its owner's, and null until then. Anyone else is sent home:
// the sidebar shows them no way to such a page, and the API would refuse
// them all the same.
export function useOwner() {
  const router = useRouter()
  const me = useMe()
  const company = me.data?.company
  const isOwner = company?.role === "owner"
  const stranger = company !== undefined && company !== null && !isOwner

  useEffect(() => {
    if (stranger) router.replace("/")
  }, [stranger, router])

  return me.data && isOwner ? { company, user: me.data.user } : null
}
