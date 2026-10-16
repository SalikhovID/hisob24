"use client"

import { BanknoteIcon, PencilIcon, UserIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Avatar } from "@/components/kit/avatar"
import { Tile, Tiles } from "@/components/kit/detail-head"
import { Foot, Group, KeyValue, Row, SectionHeading } from "@/components/kit/group"
import { Hero } from "@/components/kit/hero"
import { BackLink, PageTitle } from "@/components/kit/page-title"
import { SoftIcon } from "@/components/kit/tile-icon"
import { Failed, ListLoading, NotFound } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { ApiError } from "@/lib/api"
import { currencyOf, rateLine, som, useCurrencies, UZS } from "@/lib/currencies"
import { formatAmount, formatDate, formatDateTime, formatMoney, formatQuantity } from "@/lib/format"
import { can } from "@/lib/permissions"
import { useSale } from "@/lib/queries"
import type { Permission } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { useLocation } from "@/lib/use-location"
import { DeleteSaleButton } from "./delete-sale-button"
import { moving } from "@/lib/moves"

const back = { href: "/sales", label: "Sotuvlar" }

// SalePage is one sale in the member's locations (logic/sales.md, 3.4), for
// whoever may see the sales (changing and deleting each take their
// permission), as the prototype's page: its number over what it came to,
// what is left to pay, its customer (or retail) and moment; the tiles
// (editing, the customer, deleting); its lines, each product or service
// with how much at what price and the sum; the payments entered with it;
// its facts: the location (with two or more to work in), the currency and
// rate (with another than the so'm), the total (in so'm too), what was
// paid, the note, who entered it and when.
export function SalePage({ id }: { id: number }) {
  const gate = usePermission("sales.view")
  const companyId = gate?.company.id ?? null
  const allowed = (permission: Permission) => can(gate?.permissions, permission)
  const sale = useSale(companyId, id)
  const { locations } = useLocation()
  const currencies = useCurrencies()
  const router = useRouter()

  if (!gate) return null
  if (sale.error instanceof ApiError && sale.error.status === 404) {
    return (
      <>
        <BackLink {...back} />
        <NotFound title="Sotuv topilmadi" description="Bu sotuv o'chirilgan yoki siz ishlamaydigan lokatsiyada." />
      </>
    )
  }
  if (!sale.data || companyId === null) {
    return (
      <>
        <PageTitle title="Sotuv" back={back} />
        {sale.isError ? <Failed error={sale.error} onRetry={() => sale.refetch()} /> : <ListLoading rows={4} mark="none" />}
      </>
    )
  }
  const s = sale.data
  const currency = currencyOf(currencies, s.currency_id)
  const customer = s.customer?.name ?? "Chakana"
  const left = Number(s.total) - Number(s.paid)
  const tiles = [
    allowed("sales.edit") && <Tile key="edit" icon={PencilIcon} label="Tahrirlash" href={`/sales/${s.id}/edit`} />,
    s.customer && allowed("customers.view") && <Tile key="customer" icon={UserIcon} label="Mijoz" href={`/customers/${s.customer.id}`} />,
    allowed("sales.delete") && <DeleteSaleButton key="delete" companyId={companyId} sale={s} afterDelete={() => moving("back", () => router.replace("/sales"))} />,
  ].filter(Boolean)

  return (
    <>
      <BackLink {...back} />
      <Hero
        heading
        label={`Sotuv № ${s.number}`}
        value={s.total}
        unit={currency.symbol}
        badges={
          <>
            {left > 0 ? <Badge variant="red">Qoldi {formatAmount(left.toFixed(2))}</Badge> : <Badge variant="green">To&apos;langan</Badge>}{" "}
            <span className="font-medium text-muted-foreground">
              {customer} · {formatDateTime(s.at)}
            </span>
          </>
        }
        className="pt-2"
      />
      {tiles.length > 0 && <Tiles>{tiles}</Tiles>}
      <section aria-labelledby="sale-lines">
        <SectionHeading hint={s.items.length}>
          <span id="sale-lines">Mahsulotlar</span>
        </SectionHeading>
        <Group label="Mahsulotlar" inset="icon">
          {s.items.map((item) => (
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
        <Foot className="-mt-4 mb-6">Jami: {formatMoney(s.total, currency)}</Foot>
      </section>
      {s.payments.length > 0 && (
        <section aria-labelledby="sale-payments">
          <SectionHeading>
            <span id="sale-payments">To&apos;lovlar</span>
          </SectionHeading>
          <Group label="To'lovlar" inset="icon">
            {s.payments.map((payment) => (
              <Row
                key={payment.id}
                media={<SoftIcon icon={BanknoteIcon} color="var(--positive)" />}
                title={payment.account_name}
                end={formatMoney(payment.amount, currencyOf(currencies, payment.currency_id))}
              />
            ))}
          </Group>
        </section>
      )}
      <section aria-label="Ma'lumot">
        <SectionHeading>Ma&apos;lumot</SectionHeading>
        <Group as="dl">
          <KeyValue
            label="Mijoz"
            value={
              s.customer && allowed("customers.view") ? (
                <Link href={`/customers/${s.customer.id}`} className="text-primary">
                  {s.customer.name}
                </Link>
              ) : (
                customer
              )
            }
          />
          <KeyValue label="Vaqt" value={formatDateTime(s.at)} />
          {locations.length >= 2 && <KeyValue label="Lokatsiya" value={s.location_name} />}
          {s.currency_id !== UZS && <KeyValue label="Valyuta" value={`${currency.code} · ${rateLine({ ...currency, rate: s.rate })}`} />}
          <KeyValue label="Jami" value={formatMoney(s.total, currency)} />
          {s.currency_id !== UZS && <KeyValue label="So'mda" value={formatMoney(s.total_uzs, som)} />}
          <KeyValue label="To'langan" value={formatMoney(s.paid, currency)} />
          <KeyValue label="Izoh" value={s.note} />
          <KeyValue label="Qo'shgan" value={s.created_by_name} />
          <KeyValue label="Qo'shilgan" value={formatDate(s.created_at)} />
        </Group>
      </section>
    </>
  )
}
