"use client"

import { ClipboardCheckIcon, PencilIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { Avatar } from "@/components/kit/avatar"
import { DetailHead, Tile, Tiles } from "@/components/kit/detail-head"
import { Group, KeyValue, Row, SectionHeading } from "@/components/kit/group"
import { BackLink, PageTitle } from "@/components/kit/page-title"
import { SoftIcon } from "@/components/kit/tile-icon"
import { Failed, ListLoading, NotFound } from "@/components/states"
import { ApiError } from "@/lib/api"
import { formatDate, formatDateTime, formatQuantity } from "@/lib/format"
import { can } from "@/lib/permissions"
import { useInventory } from "@/lib/queries"
import { signedQuantity } from "@/lib/stock"
import type { Permission } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { useLocation } from "@/lib/use-location"
import { cn } from "@/lib/utils"
import { DeleteInventoryButton } from "./delete-inventory-button"

const back = { href: "/inventories", label: "Inventarizatsiya" }

// InventoryPage is one count of the member's locations (logic/warehouse.md,
// 5.2), for whoever may see the stock documents (changing and deleting
// each take their permission), as the prototype's page: its number,
// location and moment; the tiles (editing, deleting); its lines, each
// product with what the journal expected and what was counted under its
// name and the difference at its end (a surplus green, a shortage red);
// its facts.
export function InventoryPage({ id }: { id: number }) {
  const gate = usePermission("stock.view")
  const companyId = gate?.company.id ?? null
  const allowed = (permission: Permission) => can(gate?.permissions, permission)
  const inventory = useInventory(companyId, id)
  const { locations } = useLocation()
  const router = useRouter()

  if (!gate) return null
  if (inventory.error instanceof ApiError && inventory.error.status === 404) {
    return (
      <>
        <BackLink {...back} />
        <NotFound title="Inventarizatsiya topilmadi" description="Bu inventarizatsiya o'chirilgan yoki siz ishlamaydigan lokatsiyada." />
      </>
    )
  }
  if (!inventory.data || companyId === null) {
    return (
      <>
        <PageTitle title="Inventarizatsiya" back={back} />
        {inventory.isError ? <Failed error={inventory.error} onRetry={() => inventory.refetch()} /> : <ListLoading rows={4} mark="none" />}
      </>
    )
  }
  const i = inventory.data
  const tiles = [
    allowed("stock.edit") && <Tile key="edit" icon={PencilIcon} label="Tahrirlash" href={`/inventories/${i.id}/edit`} />,
    allowed("stock.delete") && <DeleteInventoryButton key="delete" companyId={companyId} inventory={i} afterDelete={() => router.replace("/inventories")} />,
  ].filter(Boolean)

  return (
    <>
      <BackLink {...back} />
      <DetailHead
        media={<SoftIcon icon={ClipboardCheckIcon} className="size-[76px] rounded-[24px] [&_svg]:size-9" />}
        title={`Inventarizatsiya № ${i.number}`}
        description={`${i.location_name} · ${formatDateTime(i.at)}`}
      />
      {tiles.length > 0 && <Tiles>{tiles}</Tiles>}
      <section aria-labelledby="inventory-lines">
        <SectionHeading hint={i.items.length}>
          <span id="inventory-lines">Mahsulotlar</span>
        </SectionHeading>
        <Group label="Mahsulotlar" inset="icon">
          {i.items.map((item) => (
            <Row
              key={item.product_id}
              href={`/products/${item.product_id}`}
              media={<Avatar name={item.name} seed={item.product_id} square letter />}
              title={item.name}
              sub={`tizim ${formatQuantity(item.expected, item.unit)} · sanalgan ${formatQuantity(item.counted, item.unit)}`}
              end={
                <span className={cn("tabular-nums", item.difference.startsWith("-") && "text-destructive", Number(item.difference) > 0 && "text-positive")}>
                  {signedQuantity(item.difference, item.unit)}
                </span>
              }
              chevron={false}
            />
          ))}
        </Group>
      </section>
      <section aria-label="Ma'lumot">
        <SectionHeading>Ma&apos;lumot</SectionHeading>
        <Group as="dl">
          {locations.length >= 2 && <KeyValue label="Lokatsiya" value={i.location_name} />}
          <KeyValue label="Vaqt" value={formatDateTime(i.at)} />
          <KeyValue label="Izoh" value={i.note} />
          <KeyValue label="Qo'shgan" value={i.created_by_name} />
          <KeyValue label="Qo'shilgan" value={formatDate(i.created_at)} />
        </Group>
      </section>
    </>
  )
}
