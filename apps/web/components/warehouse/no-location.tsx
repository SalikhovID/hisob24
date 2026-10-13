import { MapPinIcon } from "lucide-react"
import { EmptyState } from "@/components/states"

// NoLocation tells a member with no location to work in why a list or a
// form of the current location is empty (logic/locations.md, section 5),
// as the prototype's empty state.
export function NoLocation() {
  return <EmptyState icon={MapPinIcon} title="Sizga lokatsiya biriktirilmagan" description="Kompaniya egasi lokatsiya biriktirishi kerak." />
}
