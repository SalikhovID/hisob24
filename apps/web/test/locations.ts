import { db, type LocationRow, nextId } from "@/mocks/data"

// addLocation gives the company one more location, as the admin would: the
// fixture of a test about a company with several.
export function addLocation(companyId: number, name: string): LocationRow {
  const location: LocationRow = { id: nextId(), companyId, name }
  db.locations.push(location)
  return location
}

// asosiyOf is the company's ready location, the one every company starts
// with.
export function asosiyOf(companyId: number): LocationRow {
  const location = db.locations.find((l) => l.companyId === companyId && !l.deleted)
  if (!location) throw new Error(`company ${companyId} has no location`)
  return location
}
