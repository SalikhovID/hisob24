"use client"

import { PencilIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { Avatar } from "@/components/kit/avatar"
import { DataTable } from "@/components/kit/data-table"
import { Foot, Group, KeyValue, Row, SectionHeading } from "@/components/kit/group"
import { PageAction, PageActions } from "@/components/kit/page-actions"
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
import { moving } from "@/lib/moves"

const back = { href: "/opening-stock", label: "Boshlang'ich qoldiq" }

// OpeningStockDetailPage is one opening stock of the member's locations
// (logic/warehouse.md, 5.3), for whoever may see the stock documents
// (changing and deleting each take their permission), as the prototype's
// page: its number over its moment and who entered it; the actions at the
// title's right (editing, deleting); its lines (on the web a table), each
// product with how much at what price and the sum; its facts: the location
// (with two or more to work in), the currency and rate (with another than
// the so'm), the total (in so'm too), the note, who entered it and when.
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
  const actions = [
    allowed("stock.edit") && <PageAction key="edit" icon={PencilIcon} label="Tahrirlash" href={`/opening-stock/${o.id}/edit`} />,
    allowed("stock.delete") && <DeleteOpeningStockButton key="delete" companyId={companyId} opening={o} afterDelete={() => moving("back", () => router.replace("/opening-stock"))} />,
  ].filter(Boolean)

  return (
    <>
      <PageTitle
        back={back}
        title={`Boshlang'ich qoldiq № ${o.number}`}
        description={`${formatDateTime(o.at)} · ${o.created_by_name}`}
        action={actions.length > 0 && <PageActions>{actions}</PageActions>}
      />
      <section aria-labelledby="opening-lines">
        <SectionHeading hint={o.items.length}>
          <span id="opening-lines">Mahsulotlar</span>
        </SectionHeading>
        <DataTable
          label="Mahsulotlar"
          rows={o.items}
          rowKey={(item) => item.product_id}
          href={(item) => `/products/${item.product_id}`}
          columns={[
            { key: "name", label: "Mahsulot", render: (item) => item.name },
            { key: "quantity", label: "Miqdor", align: "end", render: (item) => formatQuantity(item.quantity, item.unit) },
            { key: "price", label: "Narx", align: "end", render: (item) => formatMoney(item.price, currency) },
            { key: "amount", label: "Summa", align: "end", render: (item) => <b className="font-semibold">{formatMoney(item.amount, currency)}</b> },
          ]}
          phone={
            <Group label="Mahsulotlar" inset="icon">
              {o.items.map((item) => (
                <Row
                  key={item.product_id}
                  href={`/products/${item.product_id}`}
                  media={<Avatar name={item.name} square letter />}
                  title={item.name}
                  sub={`${formatQuantity(item.quantity, item.unit)} × ${formatAmount(item.price)}`}
                  end={formatAmount(item.amount)}
                  chevron={false}
                />
              ))}
            </Group>
          }
        />
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
