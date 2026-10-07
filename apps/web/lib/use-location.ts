import { useCallback } from "react"
import { useMe } from "./queries"
import type { Location } from "./types"
import { useKept } from "./use-kept"

// CurrentLocation is where the session works now (logic/locations.md,
// section 4): the locations the member may work in, the current one among
// them (null while none is known, or there is none) and the way to choose
// another. ready says whether the session is known.
export interface CurrentLocation {
  locations: Location[]
  current: Location | null
  choose: (id: number) => void
  ready: boolean
}

// useLocation is the session's current location: the one chosen last time
// (kept in the browser, by company and member), as long as the member may
// still work in it; otherwise the first one they may. The tasks the app
// shows and enters are the current location's.
export function useLocation(): CurrentLocation {
  const me = useMe()
  const companyId = me.data?.company?.id ?? 0
  const phone = me.data?.user.phone ?? ""
  const locations = me.data?.locations ?? []
  const [kept, keep] = useKept(`location:${companyId}:${phone}`)
  const current = locations.find((l) => String(l.id) === kept) ?? locations[0] ?? null
  const choose = useCallback((id: number) => keep(String(id)), [keep])
  return { locations, current, choose, ready: me.data !== undefined }
}
