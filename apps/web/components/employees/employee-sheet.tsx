"use client"

import { MapPinIcon, PencilIcon, ShieldIcon } from "lucide-react"
import { useState } from "react"
import { Avatar } from "@/components/kit/avatar"
import { DetailHead } from "@/components/kit/detail-head"
import { Foot, Group, KeyValue, Row } from "@/components/kit/group"
import { TileIcon } from "@/components/kit/tile-icon"
import { RoleBadge } from "@/components/role-badge"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatDate } from "@/lib/format"
import { formatPhone } from "@/lib/phone"
import type { Member } from "@/lib/types"
import { cn } from "@/lib/utils"
import { EmployeeLocationsSheet } from "./employee-locations-sheet"
import { EmployeeRoleSheet } from "./employee-role-sheet"
import { RemoveEmployeeDialog } from "./remove-employee-button"
import { RenameEmployeeDialog } from "./rename-employee-dialog"

// locationsText says where a member works: every location, the
// restriction's live ones, or none (a dash: every one of them is gone).
export function locationsText(member: Member): string {
  if (member.locations === null) return "Barchasi"
  return member.locations.length > 0 ? member.locations.map((l) => l.name).join(", ") : "—"
}

// Sheet is the sheet open over this one.
type Sheet = "rename" | "role" | "locations" | "remove"

// EmployeeSheet is a member of the company as the prototype's sheet: the
// head (the avatar, the name, the phone, the role and «Siz»); for an
// employee the rows that change the name, the role and the locations (each
// with its permission: renaming takes employees.edit, the role and the
// locations are the owner's), the facts (where they work, for whoever may
// not change it; when they joined) and the way to remove them; the owner is
// the admin panel's to change, and the sheet says so.
export function EmployeeSheet({
  companyId,
  companyName,
  employee,
  you,
  can,
  severalLocations,
  open,
  onOpenChange,
}: {
  companyId: number
  companyName: string
  employee: Member
  you: boolean
  can: { rename: boolean; remove: boolean; role: boolean; locations: boolean }
  severalLocations: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const owner = employee.role === "owner"
  const name = employee.full_name ?? formatPhone(employee.phone)
  const where = locationsText(employee)
  const over = { companyId, employee, open: true, onOpenChange: (next: boolean) => !next && setSheet(null) }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xodim</DialogTitle>
          </DialogHeader>
          <DetailHead
            heading="h2"
            className="pt-1"
            media={<Avatar name={employee.full_name} seed={employee.phone} size="lg" />}
            title={name}
            description={employee.full_name ? formatPhone(employee.phone) : undefined}
            badges={
              <>
                <RoleBadge role={employee.role} name={employee.role_name} />
                {you && <Badge>Siz</Badge>}
              </>
            }
          />
          {owner ? (
            <>
              <Group as="dl">
                <KeyValue label="Rol" value="Egasi" />
                {severalLocations && <KeyValue label="Lokatsiyalar" value="Barchasi" />}
                <KeyValue label="Qo'shilgan" value={formatDate(employee.created_at)} />
              </Group>
              <Foot className="-mt-4">Kompaniya egasini o&apos;zgartirib yoki o&apos;chirib bo&apos;lmaydi. Egasini faqat platforma administratori almashtiradi.</Foot>
            </>
          ) : (
            <>
              {(can.rename || can.role || (can.locations && severalLocations)) && (
                <Group inset="tile">
                  {can.rename && <Row onClick={() => setSheet("rename")} media={<TileIcon icon={PencilIcon} color="#8E8E93" />} title="Ism" end={employee.full_name ?? "—"} />}
                  {can.role && <Row onClick={() => setSheet("role")} media={<TileIcon icon={ShieldIcon} color="#FF3B30" />} title="Rol" end={employee.role_name ?? "Rolsiz"} />}
                  {can.locations && severalLocations && (
                    <Row
                      onClick={() => setSheet("locations")}
                      media={<TileIcon icon={MapPinIcon} color="#FF9500" />}
                      title="Lokatsiyalar"
                      end={<span className={cn(where === "—" && "text-destructive")}>{where}</span>}
                    />
                  )}
                </Group>
              )}
              <Group as="dl">
                {severalLocations && !can.locations && <KeyValue label="Lokatsiyalar" value={where} />}
                <KeyValue label="Qo'shilgan" value={formatDate(employee.created_at)} />
              </Group>
              {can.remove && (
                <Group>
                  <Row variant="danger" onClick={() => setSheet("remove")} title="Xodimni o'chirish" />
                </Group>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
      {sheet === "rename" && <RenameEmployeeDialog {...over} />}
      {sheet === "role" && <EmployeeRoleSheet {...over} />}
      {sheet === "locations" && <EmployeeLocationsSheet {...over} />}
      {sheet === "remove" && <RemoveEmployeeDialog {...over} companyName={companyName} />}
    </>
  )
}
