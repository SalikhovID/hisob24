"use client"

import { useRouter } from "next/navigation"
import { Fact } from "@/components/facts"
import { PageHeader } from "@/components/page-header"
import { Failed, ListLoading } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { ApiError } from "@/lib/api"
import { formatAmount, formatDate, unitLabel } from "@/lib/format"
import { can } from "@/lib/permissions"
import { useProduct } from "@/lib/queries"
import type { Permission, ProductKind } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { ActiveButton } from "./active-button"
import { DeleteProductButton } from "./delete-product-button"
import { ProductDialog } from "./product-dialog"
import { ProductPurchases } from "./product-purchases"
import { ProductStock } from "./product-stock"
import { ServiceDialog } from "./service-dialog"

// backTo is the list a record's page leads back to: a service is listed
// among the services (it has no page of its own, but the address opens).
const backTo = (kind: ProductKind) =>
  kind === "service" ? { href: "/services", label: "Xizmatlar" } : { href: "/products", label: "Mahsulotlar" }

// ProductPage is one product of the company (logic/products.md, section 6),
// for whoever may see the products (changing, turning off and deleting each
// take their permission): its unit and SKU, its price, its note, who
// entered it and when. The stock and the purchases come with the warehouse.
export function ProductPage({ id }: { id: number }) {
  const gate = usePermission("products.view")
  const companyId = gate?.company.id ?? null
  const allowed = (permission: Permission) => can(gate?.permissions, permission)
  const product = useProduct(companyId, id)
  const router = useRouter()

  // Until the session is known to be let in there is nothing to show; a
  // stranger is on their way home.
  if (!gate) return null
  // A product that is gone, or is another company's, is not found: there
  // is nothing to try again.
  if (product.error instanceof ApiError && product.error.status === 404) {
    return (
      <PageHeader
        title="Mahsulot topilmadi"
        description="Bu mahsulot o'chirilgan yoki sizning kompaniyangizniki emas."
        back={backTo("product")}
      />
    )
  }
  if (!product.data) {
    return (
      <div className="space-y-5">
        <PageHeader title="Mahsulot" back={backTo("product")} />
        {product.isError ? <Failed error={product.error} onRetry={() => product.refetch()} /> : <ListLoading rows={4} mark="none" />}
      </div>
    )
  }
  const p = product.data
  const isProduct = p.kind === "product"
  const back = backTo(p.kind)
  const line = isProduct ? [p.unit && unitLabel(p.unit), p.sku].filter(Boolean).join(" · ") : "Xizmat"

  return (
    <div className="space-y-5">
      <PageHeader
        title={p.name}
        description={
          <>
            {line}
            {!p.is_active && (
              <>
                {" "}
                <Badge variant="outline">Nofaol</Badge>
              </>
            )}
          </>
        }
        back={back}
        stack
        actions={
          companyId !== null &&
          (allowed("products.edit") || allowed("products.delete")) && (
            <>
              {allowed("products.edit") &&
                (isProduct ? <ProductDialog companyId={companyId} product={p} /> : <ServiceDialog companyId={companyId} service={p} />)}
              {allowed("products.edit") && <ActiveButton companyId={companyId} product={p} />}
              {allowed("products.delete") && (
                <DeleteProductButton companyId={companyId} product={p} afterDelete={() => router.replace(back.href)} />
              )}
            </>
          )
        }
      />
      <section aria-labelledby="product-info" className="space-y-3">
        <h2 id="product-info" className="text-base font-semibold">
          Ma&apos;lumot
        </h2>
        <dl className="divide-y rounded-xl border bg-card tabular-nums">
          {isProduct && <Fact name="Birlik" value={p.unit && unitLabel(p.unit)} />}
          <Fact name="Narx" value={p.price && formatAmount(p.price)} />
          {isProduct && <Fact name="Oxirgi xarid narxi" value={p.last_price && `${formatAmount(p.last_price)} so'm`} />}
          {isProduct && <Fact name="Artikul" value={p.sku} />}
          <Fact name="Izoh" value={p.note} />
          <Fact name="Qo'shgan" value={p.created_by_name} />
          <Fact name="Qo'shilgan" value={formatDate(p.created_at)} />
        </dl>
      </section>
      {/* The stock in every location of the member, and the purchases the product is in (for whoever may see the purchases). */}
      {isProduct && <ProductStock stock={p.stock} unit={p.unit} />}
      {isProduct && companyId !== null && allowed("purchases.view") && <ProductPurchases companyId={companyId} productId={p.id} unit={p.unit} />}
    </div>
  )
}
