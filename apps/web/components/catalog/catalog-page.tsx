"use client"

import { useState } from "react"
import { type Column, DataList } from "@/components/data-list"
import { PageHeader } from "@/components/page-header"
import { Pager } from "@/components/pager"
import { SectionTabs } from "@/components/section-tabs"
import { EmptyState, Failed, ListLoading } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatAmount, formatDate, formatQuantity, unitLabel } from "@/lib/format"
import { navItems } from "@/lib/nav"
import { can } from "@/lib/permissions"
import { useProducts } from "@/lib/queries"
import type { Permission, Product, ProductKind } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { useLocation } from "@/lib/use-location"
import { SearchInput } from "@/components/customers/search-input"
import { ActiveButton } from "./active-button"
import { DeleteProductButton } from "./delete-product-button"
import { ProductDialog } from "./product-dialog"
import { ServiceDialog } from "./service-dialog"
import { useCatalogFilter } from "./use-catalog-filter"

// A tab is quiet until it is the chosen one, which then stands out as a card
// on the muted strip. Never the brand color: that is the page's one button.
const tab = "px-3 text-muted-foreground data-active:bg-card"

const productsSection = navItems.find((item) => item.key === "products")!

// CatalogPage is the company's products, or its services (kind), for
// whoever may see them (products.view; adding, editing and deleting each
// take their permission): by name, the active ones unless the «Nofaol» tab
// is open, searched by name (and SKU). A product has a page; a service is
// handled in its row.
export function CatalogPage({ kind }: { kind: ProductKind }) {
  const gate = usePermission("products.view")
  const companyId = gate?.company.id ?? null
  const allowed = (permission: Permission) => can(gate?.permissions, permission)
  const [filter, update] = useCatalogFilter()
  // The stock shown is the current location's (logic/products.md, section 5).
  const location = useLocation()
  const products = useProducts(companyId, { kind, ...filter, locationId: location.current?.id ?? null })
  const isProduct = kind === "product"
  const noun = isProduct ? "Mahsulot" : "Xizmat"
  const plural = isProduct ? "Mahsulotlar" : "Xizmatlar"
  const whose = isProduct ? "Kompaniyangiz mahsulotlari" : "Kompaniyangiz xizmatlari"

  const columns: Column<Product>[] = [
    { header: noun, primary: true, cell: (p) => p.name },
    ...(isProduct
      ? [
          { header: "Artikul", card: "inline", className: "text-muted-foreground", cell: (p) => p.sku } satisfies Column<Product>,
          {
            header: "Birlik",
            card: "tag",
            cell: (p) => p.unit && <Badge variant="secondary">{unitLabel(p.unit)}</Badge>,
          } satisfies Column<Product>,
        ]
      : []),
    { header: "Narx", align: "end", card: "aside", cell: (p) => p.price && formatAmount(p.price) },
    ...(isProduct
      ? [{ header: "Qoldiq", card: "inline", className: "tabular-nums", cell: (p) => p.quantity !== null && formatQuantity(p.quantity, p.unit) } satisfies Column<Product>]
      : []),
    { header: "Qo'shgan", className: "text-muted-foreground", cell: (p) => p.created_by_name },
    { header: "Qo'shilgan", card: "inline", className: "text-muted-foreground", cell: (p) => formatDate(p.created_at) },
    ...(isProduct
      ? []
      : [
          {
            header: "Amallar",
            actions: true,
            cell: (p) =>
              companyId !== null &&
              (allowed("products.edit") || allowed("products.delete")) && (
                <span className="inline-flex items-center justify-end gap-1 max-md:gap-2 pointer-coarse:gap-2">
                  {allowed("products.edit") && <ServiceDialog companyId={companyId} service={p} iconOnly />}
                  {allowed("products.edit") && <ActiveButton companyId={companyId} product={p} iconOnly />}
                  {allowed("products.delete") && <DeleteProductButton companyId={companyId} product={p} iconOnly />}
                </span>
              ),
          } satisfies Column<Product>,
        ]),
  ]

  // How many records the company has is the unfiltered list's total: under
  // the «Nofaol» tab or a search the API counts the matches only.
  const unfiltered = filter.status === "active" && !filter.search
  const [total, setTotal] = useState<number>()
  if (unfiltered && products.data && !products.isPlaceholderData && products.data.total !== total) {
    setTotal(products.data.total)
  }
  // A list of the previous filter may stay on screen while the next loads;
  // "nothing found" may not.
  const settling = products.isPlaceholderData && products.data?.total === 0
  const loading = products.isPending || settling

  // Until the session is known to be let in there is nothing to show; a
  // stranger is on their way home.
  if (!gate) return null
  return (
    <div className="space-y-5">
      <SectionTabs item={productsSection} permissions={gate.permissions} />
      <PageHeader
        title={plural}
        description={unfiltered && total !== undefined ? `${whose} · ${total} ta` : whose}
        actions={
          companyId !== null &&
          allowed("products.create") &&
          (isProduct ? <ProductDialog companyId={companyId} /> : <ServiceDialog companyId={companyId} />)
        }
      />
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={filter.status} onValueChange={(value) => update({ status: value === "inactive" ? "inactive" : "active" })}>
            <TabsList aria-label="Holat" className="group-data-horizontal/tabs:h-9">
              <TabsTrigger value="active" className={tab}>
                Faol
              </TabsTrigger>
              <TabsTrigger value="inactive" className={tab}>
                Nofaol
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <SearchInput value={filter.search} onSearch={(search) => update({ search })} placeholder={isProduct ? "Nom yoki artikul" : "Nom"} />
        </div>
        {loading && <ListLoading rows={6} mark="none" />}
        {products.isError && <Failed error={products.error} onRetry={() => products.refetch()} />}
        {!loading && !products.isError && products.data?.total === 0 && (
          <EmptyState
            title={unfiltered ? `Hali ${noun.toLowerCase()} yo'q` : `${plural} topilmadi`}
            description={
              unfiltered
                ? `Birinchi ${noun.toLowerCase()}ni «${noun} qo'shish» tugmasi orqali qo'shing.`
                : "Qidiruv yoki filtrni o'zgartirib ko'ring."
            }
          />
        )}
        {!loading && !products.isError && products.data && products.data.total > 0 && (
          <DataList
            label={plural}
            items={products.data.items}
            columns={columns}
            getKey={(p) => p.id}
            href={isProduct ? (p) => `/products/${p.id}` : undefined}
            footer={
              <Pager page={products.data.page} pageSize={products.data.page_size} total={products.data.total} onPage={(page) => update({ page })} />
            }
          />
        )}
      </div>
    </div>
  )
}
