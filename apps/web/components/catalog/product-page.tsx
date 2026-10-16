"use client"

import { PackagePlusIcon, PencilIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Avatar } from "@/components/kit/avatar"
import { DetailHead, Tile, Tiles } from "@/components/kit/detail-head"
import { Group, KeyValue, SectionHeading } from "@/components/kit/group"
import { Hero } from "@/components/kit/hero"
import { BackLink, PageTitle } from "@/components/kit/page-title"
import { Failed, ListLoading, NotFound } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { ApiError } from "@/lib/api"
import { currencyOf, useCurrencies } from "@/lib/currencies"
import { formatDate, formatMoney, unitLabel } from "@/lib/format"
import { can } from "@/lib/permissions"
import { useProduct } from "@/lib/queries"
import type { Permission, ProductKind } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { useLocation } from "@/lib/use-location"
import { ActiveButton } from "./active-button"
import { DeleteProductButton } from "./delete-product-button"
import { ProductDialog } from "./product-dialog"
import { ProductMoves } from "./product-moves"
import { ProductPurchases } from "./product-purchases"
import { ProductStock } from "./product-stock"
import { ServiceDialog } from "./service-dialog"
import { moving } from "@/lib/moves"

// backTo is the list a record's page leads back to: a service is listed
// among the services (it has no page of its own, but the address opens).
const backTo = (kind: ProductKind) =>
  kind === "service" ? { href: "/services", label: "Xizmatlar" } : { href: "/products", label: "Mahsulotlar" }

// ProductPage is one product of the company (logic/products.md, section 6),
// for whoever may see the products (changing, turning off and deleting each
// take their permission), as the prototype's page: its letter, name, unit
// and SKU, its sale price large, the tiles (editing, a purchase of it,
// turning it off), its stock in each location of the member, its facts,
// the purchases it is in and its moves (each with its permission), and at
// the foot the way to delete it.
export function ProductPage({ id }: { id: number }) {
  const gate = usePermission("products.view")
  const companyId = gate?.company.id ?? null
  const allowed = (permission: Permission) => can(gate?.permissions, permission)
  const product = useProduct(companyId, id)
  const router = useRouter()
  const currencies = useCurrencies()
  const location = useLocation()
  const [editing, setEditing] = useState(false)

  // Until the session is known to be let in there is nothing to show; a
  // stranger is on their way home.
  if (!gate) return null
  // A product that is gone, or is another company's, is not found: there
  // is nothing to try again.
  if (product.error instanceof ApiError && product.error.status === 404) {
    return (
      <>
        <BackLink {...backTo("product")} />
        <NotFound title="Mahsulot topilmadi" description="Bu mahsulot o'chirilgan yoki sizning kompaniyangizniki emas." />
      </>
    )
  }
  if (!product.data || companyId === null) {
    return (
      <>
        <PageTitle title="Mahsulot" back={backTo("product")} />
        {product.isError ? <Failed error={product.error} onRetry={() => product.refetch()} /> : <ListLoading rows={4} mark="none" />}
      </>
    )
  }
  const p = product.data
  const isProduct = p.kind === "product"
  const back = backTo(p.kind)
  const currency = currencyOf(currencies, p.currency_id)
  // A purchase of the product is entered into the current location, by
  // whoever may add purchases and find the suppliers; not of an inactive one.
  const canBuy = isProduct && p.is_active && allowed("purchases.create") && allowed("suppliers.view") && location.current !== null
  const tiles = [
    allowed("products.edit") && <Tile key="edit" icon={PencilIcon} label="Tahrirlash" onClick={() => setEditing(true)} />,
    canBuy && <Tile key="buy" icon={PackagePlusIcon} label="Xarid" href={`/purchases/new?product=${p.id}`} />,
    allowed("products.edit") && <ActiveButton key="active" companyId={companyId} product={p} />,
  ].filter(Boolean)

  return (
    <>
      <BackLink {...back} />
      <DetailHead
        media={<Avatar name={p.name} square letter size="lg" />}
        title={p.name}
        description={isProduct ? [p.unit && unitLabel(p.unit), p.sku].filter(Boolean).join(" · ") || undefined : "Xizmat"}
        badges={!p.is_active && <Badge>Nofaol</Badge>}
      />
      {p.price && <Hero plain label="Sotuv narxi" value={p.price} unit={currency.symbol} className="-mt-3 pt-0 pb-5" />}
      {tiles.length > 0 && <Tiles>{tiles}</Tiles>}
      {/* The stock in every location of the member, the current one marked. */}
      {isProduct && <ProductStock stock={p.stock} unit={p.unit} currentId={location.current?.id ?? null} />}
      <section aria-label="Ma'lumot">
        <SectionHeading>Ma&apos;lumot</SectionHeading>
        <Group as="dl">
          {isProduct && <KeyValue label="Birlik" value={p.unit && unitLabel(p.unit)} />}
          <KeyValue label="Narx" value={p.price && formatMoney(p.price, currency)} />
          {isProduct && (
            <KeyValue label="Oxirgi xarid narxi" value={p.last_price && formatMoney(p.last_price.amount, currencyOf(currencies, p.last_price.currency_id))} />
          )}
          {isProduct && <KeyValue label="Artikul" value={p.sku} />}
          <KeyValue label="Izoh" value={p.note} />
          <KeyValue label="Qo'shgan" value={p.created_by_name} />
          <KeyValue label="Qo'shilgan" value={formatDate(p.created_at)} />
        </Group>
      </section>
      {/* The purchases the product is in (for whoever may see the purchases), its moves (with the stock documents' permission). */}
      {isProduct && allowed("purchases.view") && <ProductPurchases companyId={companyId} productId={p.id} unit={p.unit} />}
      {isProduct && allowed("stock.view") && <ProductMoves companyId={companyId} productId={p.id} unit={p.unit} />}
      {allowed("products.delete") && <DeleteProductButton companyId={companyId} product={p} afterDelete={() => moving("back", () => router.replace(back.href))} />}
      {editing &&
        (isProduct ? (
          <ProductDialog companyId={companyId} product={p} open onOpenChange={(open) => !open && setEditing(false)} />
        ) : (
          <ServiceDialog companyId={companyId} service={p} open onOpenChange={(open) => !open && setEditing(false)} />
        ))}
    </>
  )
}
