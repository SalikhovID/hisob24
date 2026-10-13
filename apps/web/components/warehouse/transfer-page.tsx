"use client"

import { ArrowLeftRightIcon, PencilIcon } from "lucide-react"
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
import { useTransfer } from "@/lib/queries"
import type { Permission } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { useLocation } from "@/lib/use-location"
import { DeleteTransferButton } from "./delete-transfer-button"

const back = { href: "/transfers", label: "Ko'chirishlar" }

// TransferPage is one transfer out of or into the member's locations
// (logic/warehouse.md, 5.1), for whoever may see the stock documents, as
// the prototype's page: its number, its two ends and moment; the tiles
// (editing, deleting: their permission and the source among the member's
// locations); its lines, each product with how much moved; its facts.
export function TransferPage({ id }: { id: number }) {
  const gate = usePermission("stock.view")
  const companyId = gate?.company.id ?? null
  const allowed = (permission: Permission) => can(gate?.permissions, permission)
  const transfer = useTransfer(companyId, id)
  const { locations } = useLocation()
  const router = useRouter()

  if (!gate) return null
  if (transfer.error instanceof ApiError && transfer.error.status === 404) {
    return (
      <>
        <BackLink {...back} />
        <NotFound title="Ko'chirish topilmadi" description="Bu ko'chirish o'chirilgan yoki siz ishlamaydigan lokatsiyalar orasida." />
      </>
    )
  }
  if (!transfer.data || companyId === null) {
    return (
      <>
        <PageTitle title="Ko'chirish" back={back} />
        {transfer.isError ? <Failed error={transfer.error} onRetry={() => transfer.refetch()} /> : <ListLoading rows={4} mark="none" />}
      </>
    )
  }
  const t = transfer.data
  // A transfer seen from its destination alone is not the member's to change.
  const mine = locations.some((l) => l.id === t.location_id)
  const tiles = [
    mine && allowed("stock.edit") && <Tile key="edit" icon={PencilIcon} label="Tahrirlash" href={`/transfers/${t.id}/edit`} />,
    mine && allowed("stock.delete") && <DeleteTransferButton key="delete" companyId={companyId} transfer={t} afterDelete={() => router.replace("/transfers")} />,
  ].filter(Boolean)

  return (
    <>
      <BackLink {...back} />
      <DetailHead
        media={<SoftIcon icon={ArrowLeftRightIcon} className="size-[76px] rounded-[24px] [&_svg]:size-9" />}
        title={`Ko'chirish № ${t.number}`}
        description={`${t.location_name} → ${t.to_location_name} · ${formatDateTime(t.at)}`}
      />
      {tiles.length > 0 && <Tiles>{tiles}</Tiles>}
      <section aria-labelledby="transfer-lines">
        <SectionHeading hint={t.items.length}>
          <span id="transfer-lines">Mahsulotlar</span>
        </SectionHeading>
        <Group label="Mahsulotlar" inset="icon">
          {t.items.map((item) => (
            <Row
              key={item.product_id}
              href={`/products/${item.product_id}`}
              media={<Avatar name={item.name} seed={item.product_id} square letter />}
              title={item.name}
              end={formatQuantity(item.quantity, item.unit)}
              chevron={false}
            />
          ))}
        </Group>
      </section>
      <section aria-label="Ma'lumot">
        <SectionHeading>Ma&apos;lumot</SectionHeading>
        <Group as="dl">
          <KeyValue label="Qayerdan" value={t.location_name} />
          <KeyValue label="Qayerga" value={t.to_location_name} />
          <KeyValue label="Vaqt" value={formatDateTime(t.at)} />
          <KeyValue label="Izoh" value={t.note} />
          <KeyValue label="Qo'shgan" value={t.created_by_name} />
          <KeyValue label="Qo'shilgan" value={formatDate(t.created_at)} />
        </Group>
      </section>
    </>
  )
}
