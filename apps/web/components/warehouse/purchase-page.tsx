"use client"

import { BanknoteIcon, PencilIcon, TruckIcon } from "lucide-react"
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
import { usePurchase } from "@/lib/queries"
import type { Permission } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { useLocation } from "@/lib/use-location"
import { DeletePurchaseButton } from "./delete-purchase-button"
import { stepBack } from "@/lib/moves"

const back = { href: "/purchases", label: "Xaridlar" }

// PurchasePage is one purchase in the member's locations (logic/warehouse.md,
// 4.5), for whoever may see the purchases (changing and deleting each take
// their permission), as the prototype's page: its number over what it came
// to, what is left to pay, its supplier and moment; the tiles (editing, the
// supplier, deleting); its lines, each product with how much at what price
// and the sum; the payments entered with it; and its facts: the location
// (with two or more to work in), the currency and rate (with another than
// the so'm), the total (in so'm too), what was paid, the note, who entered
// it and when.
export function PurchasePage({ id }: { id: number }) {
  const gate = usePermission("purchases.view")
  const companyId = gate?.company.id ?? null
  const allowed = (permission: Permission) => can(gate?.permissions, permission)
  const purchase = usePurchase(companyId, id)
  const { locations } = useLocation()
  const currencies = useCurrencies()
  const router = useRouter()

  // Until the session is known to be let in there is nothing to show; a
  // stranger is on their way home.
  if (!gate) return null
  // A purchase that is gone, or stands in a location the member does not
  // work in, is not found: there is nothing to try again.
  if (purchase.error instanceof ApiError && purchase.error.status === 404) {
    return (
      <>
        <BackLink {...back} />
        <NotFound title="Xarid topilmadi" description="Bu xarid o'chirilgan yoki siz ishlamaydigan lokatsiyada." />
      </>
    )
  }
  if (!purchase.data || companyId === null) {
    return (
      <>
        <PageTitle title="Xarid" back={back} />
        {purchase.isError ? <Failed error={purchase.error} onRetry={() => purchase.refetch()} /> : <ListLoading rows={4} mark="none" />}
      </>
    )
  }
  const p = purchase.data
  const currency = currencyOf(currencies, p.currency_id)
  const left = Number(p.total) - Number(p.paid)
  const tiles = [
    allowed("purchases.edit") && <Tile key="edit" icon={PencilIcon} label="Tahrirlash" href={`/purchases/${p.id}/edit`} />,
    allowed("suppliers.view") && <Tile key="supplier" icon={TruckIcon} label="Ta'minotchi" href={`/suppliers/${p.supplier.id}`} />,
    allowed("purchases.delete") && <DeletePurchaseButton key="delete" companyId={companyId} purchase={p} afterDelete={() => router.replace("/purchases", { transitionTypes: stepBack })} />,
  ].filter(Boolean)

  return (
    <>
      <BackLink {...back} />
      <Hero
        heading
        label={`Xarid № ${p.number}`}
        value={p.total}
        unit={currency.symbol}
        badges={
          <>
            {left > 0 ? <Badge variant="red">Qoldi {formatAmount(left.toFixed(2))}</Badge> : <Badge variant="green">To&apos;langan</Badge>}{" "}
            <span className="font-medium text-muted-foreground">
              {p.supplier.name} · {formatDateTime(p.at)}
            </span>
          </>
        }
        className="pt-2"
      />
      {tiles.length > 0 && <Tiles>{tiles}</Tiles>}
      <section aria-labelledby="purchase-lines">
        <SectionHeading hint={p.items.length}>
          <span id="purchase-lines">Mahsulotlar</span>
        </SectionHeading>
        <Group label="Mahsulotlar" inset="icon">
          {p.items.map((item) => (
            <Row
              key={item.product_id}
              href={allowed("products.view") ? `/products/${item.product_id}` : undefined}
              media={<Avatar name={item.name} seed={item.product_id} square letter />}
              title={item.name}
              sub={`${formatQuantity(item.quantity, item.unit)} × ${formatAmount(item.price)}`}
              end={formatAmount(item.amount)}
              chevron={false}
            />
          ))}
        </Group>
        <Foot className="-mt-4 mb-6">Jami: {formatMoney(p.total, currency)}</Foot>
      </section>
      {p.payments.length > 0 && (
        <section aria-labelledby="purchase-payments">
          <SectionHeading>
            <span id="purchase-payments">To&apos;lovlar</span>
          </SectionHeading>
          <Group label="To'lovlar" inset="icon">
            {p.payments.map((payment) => (
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
            label="Ta'minotchi"
            value={
              allowed("suppliers.view") ? (
                <Link href={`/suppliers/${p.supplier.id}`} className="text-primary">
                  {p.supplier.name}
                </Link>
              ) : (
                p.supplier.name
              )
            }
          />
          <KeyValue label="Vaqt" value={formatDateTime(p.at)} />
          {locations.length >= 2 && <KeyValue label="Lokatsiya" value={p.location_name} />}
          {p.currency_id !== UZS && <KeyValue label="Valyuta" value={`${currency.code} · ${rateLine({ ...currency, rate: p.rate })}`} />}
          <KeyValue label="Jami" value={formatMoney(p.total, currency)} />
          {p.currency_id !== UZS && <KeyValue label="So'mda" value={formatMoney(p.total_uzs, som)} />}
          <KeyValue label="To'langan" value={formatMoney(p.paid, currency)} />
          <KeyValue label="Izoh" value={p.note} />
          <KeyValue label="Qo'shgan" value={p.created_by_name} />
          <KeyValue label="Qo'shilgan" value={formatDate(p.created_at)} />
        </Group>
      </section>
    </>
  )
}
