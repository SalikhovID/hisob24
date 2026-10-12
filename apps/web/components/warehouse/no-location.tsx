// NoLocation tells a member with no location to work in why a list or a
// form of the current location is empty (logic/locations.md, section 5).
export function NoLocation() {
  return (
    <div className="rounded-xl border bg-card px-4 py-10 text-center text-sm">
      <p className="font-medium">Sizga lokatsiya biriktirilmagan</p>
      <p className="mt-1 text-pretty text-muted-foreground">Kompaniya egasi lokatsiya biriktirishi kerak.</p>
    </div>
  )
}
