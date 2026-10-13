"use client"

import { PencilIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { Avatar } from "@/components/kit/avatar"
import { Tile, Tiles } from "@/components/kit/detail-head"
import { Foot, Group, KeyValue, Row, SectionHeading } from "@/components/kit/group"
import { Hero } from "@/components/kit/hero"
import { BackLink, PageTitle } from "@/components/kit/page-title"
import { Failed, ListLoading, NotFound } from "@/components/states"
import { ApiError } from "@/lib/api"
import { currencyOf, rateLine, som, useCurrencies, UZS } from "@/lib/currencies"
import { formatAmount, formatDate, formatDateTime, formatMoney, formatQuantity } from "@/lib/format"
import { can } from "@/lib/permissions"
import { useOpeningStock } from "@/lib/queries"
import type { Permission } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { useLocation } from "@/lib/use-location"
import { DeleteOpeningStockButton } from "./delete-opening-stock-button"
import { stepBack } from "@/lib/moves"

const back = { href: "/opening-stock", label: "Boshlang'ich qoldiq" }

// OpeningStockDetailPage is one opening stock of the member's locations
// (logic/warehouse.md, 5.3), for whoever may see the stock documents
// (changing and deleting each take their permission), as the prototype's
// page: its number over what it came to, its location and moment; the
// tiles (editing, deleting); its lines, each product with how much at what
// price and the sum; its facts: the location (with two or more to work
// in), the currency and rate (with another than the so'm), the total (in
// so'm too), the note, who entered it and when.
export function OpeningStockDetailPage({ id }: { id: number }) {
  const gate = usePermission("stock.view")
  const companyId = gate?.company.id ?? null
  const allowed = (permission: Permission) => can(gate?.permissions, permission)
  const opening = useOpeningStock(companyId, id)
  const { locations } = useLocation()
  const currencies = useCurrencies()
  const router = useRouter()

  if (!gate) return null
  if (opening.error instanceof ApiError && opening.error.status === 404) {
    return (
      <>
        <BackLink {...back} />
        <NotFound title="Hujjat topilmadi" description="Bu hujjat o'chirilgan yoki siz ishlamaydigan lokatsiyada." />
      </>
    )
  }
  if (!opening.data || companyId === null) {
    return (
      <>
        <PageTitle title="Boshlang'ich qoldiq" back={back} />
        {opening.isError ? <Failed error={opening.error} onRetry={() => opening.refetch()} /> : <ListLoading rows={4} mark="none" />}
      </>
    )
  }
  const o = opening.data
  const currency = currencyOf(currencies, o.currency_id)
  const tiles = [
    allowed("stock.edit") && <Tile key="edit" icon={PencilIcon} label="Tahrirlash" href={`/opening-stock/${o.id}/edit`} />,
    allowed("stock.delete") && <DeleteOpeningStockButton key="delete" companyId={companyId} opening={o} afterDelete={() => router.replace("/opening-stock", { transitionTypes: stepBack })} />,
  ].filter(Boolean)

  return (
    <>
      <BackLink {...back} />
      <Hero
        heading
        label={`Boshlang'ich qoldiq № ${o.number}`}
        value={o.total}
        unit={currency.symbol}
        badges={
          <span className="font-medium text-muted-foreground">
            {o.location_name} · {formatDateTime(o.at)}
          </span>
        }
        className="pt-2"
      />
      {tiles.length > 0 && <Tiles>{tiles}</Tiles>}
      <section aria-labelledby="opening-lines">
        <SectionHeading hint={o.items.length}>
          <span id="opening-lines">Mahsulotlar</span>
        </SectionHeading>
        <Group label="Mahsulotlar" inset="icon">
          {o.items.map((item) => (
            <Row
              key={item.product_id}
              href={`/products/${item.product_id}`}
              media={<Avatar name={item.name} seed={item.product_id} square letter />}
              title={item.name}
              sub={`${formatQuantity(item.quantity, item.unit)} × ${formatAmount(item.price)}`}
              end={formatAmount(item.amount)}
              chevron={false}
            />
          ))}
        </Group>
        <Foot className="-mt-4 mb-6">Jami: {formatMoney(o.total, currency)}</Foot>
      </section>
      <section aria-label="Ma'lumot">
        <SectionHeading>Ma&apos;lumot</SectionHeading>
        <Group as="dl">
          {locations.length >= 2 && <KeyValue label="Lokatsiya" value={o.location_name} />}
          <KeyValue label="Vaqt" value={formatDateTime(o.at)} />
          {o.currency_id !== UZS && <KeyValue label="Valyuta" value={`${currency.code} · ${rateLine({ ...currency, rate: o.rate })}`} />}
          <KeyValue label="Jami" value={formatMoney(o.total, currency)} />
          {o.currency_id !== UZS && <KeyValue label="So'mda" value={formatMoney(o.total_uzs, som)} />}
          <KeyValue label="Izoh" value={o.note} />
          <KeyValue label="Qo'shgan" value={o.created_by_name} />
          <KeyValue label="Qo'shilgan" value={formatDate(o.created_at)} />
        </Group>
      </section>
    </>
  )
}
