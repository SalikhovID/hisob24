"use client"

import { PackageIcon, SearchIcon } from "lucide-react"
import { useState } from "react"
import { ActionSheet, type ActionItem } from "@/components/kit/action-sheet"
import { Avatar } from "@/components/kit/avatar"
import { ChoiceChips } from "@/components/kit/chips"
import { Foot, Group, Row } from "@/components/kit/group"
import { PageTitle, PlusButton } from "@/components/kit/page-title"
import { SearchBox } from "@/components/kit/search-box"
import { Pager } from "@/components/pager"
import { SectionTabs } from "@/components/section-tabs"
import { EmptyState, Failed, ListLoading } from "@/components/states"
import { currencyOf, useCurrencies } from "@/lib/currencies"
import { formatAmount, formatDate, formatMoney, formatQuantity, unitLabel } from "@/lib/format"
import { navItems } from "@/lib/nav"
import { can } from "@/lib/permissions"
import { useProducts } from "@/lib/queries"
import type { Permission, Product, ProductKind } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { useLocation } from "@/lib/use-location"
import { cn } from "@/lib/utils"
import { useProductActive } from "./active-button"
import { DeleteProductDialog } from "./delete-product-button"
import { ProductDialog } from "./product-dialog"
import { ServiceDialog } from "./service-dialog"
import { useCatalogFilter } from "./use-catalog-filter"

const productsSection = navItems.find((item) => item.key === "products")!

// CatalogPage is the company's products, or its services (kind), for
// whoever may see them (products.view; adding, editing and deleting each
// take their permission), as the prototype's list: by name, the active ones
// unless the «Nofaol» chip is on (each chip says how many), searched by
// name (and SKU). A product is a row that leads to its page: its unit, SKU
// and the current location's stock under its name, its price per unit at
// its end. A service is handled in a sheet of actions its row opens.
export function CatalogPage({ kind }: { kind: ProductKind }) {
  const gate = usePermission("products.view")
  const companyId = gate?.company.id ?? null
  const allowed = (permission: Permission) => can(gate?.permissions, permission)
  const [filter, update] = useCatalogFilter()
  // The stock shown is the current location's (logic/products.md, section 5).
  const location = useLocation()
  const locationId = location.current?.id ?? null
  const products = useProducts(companyId, { kind, ...filter, locationId })
  // The chips' counts: every active record and every inactive one, whatever
  // is searched. The active one is the list itself when nothing is.
  const active = useProducts(companyId, { kind, status: "active", search: "", page: 1, locationId })
  const inactive = useProducts(companyId, { kind, status: "inactive", search: "", page: 1, locationId })
  // A price is shown with its currency (logic/currencies.md, section 6).
  const currencies = useCurrencies()
  const toggle = useProductActive(companyId ?? 0)
  const [adding, setAdding] = useState(false)
  const [acting, setActing] = useState<Product | null>(null)
  const [editing, setEditing] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState<Product | null>(null)
  const isProduct = kind === "product"
  const noun = isProduct ? "Mahsulot" : "Xizmat"
  const plural = isProduct ? "Mahsulotlar" : "Xizmatlar"
  const whose = isProduct ? "Kompaniyangiz mahsulotlari" : "Kompaniyangiz xizmatlari"
  const activeCount = active.data && !active.isPlaceholderData ? active.data.total : undefined
  const inactiveCount = inactive.data && !inactive.isPlaceholderData ? inactive.data.total : undefined

  const unfiltered = filter.status === "active" && !filter.search
  // A list of the previous filter may stay on screen while the next loads;
  // "nothing found" may not.
  const settling = products.isPlaceholderData && products.data?.total === 0
  const loading = products.isPending || settling
  const canAdd = companyId !== null && allowed("products.create")

  // A service's actions: changing it and turning it off take products.edit,
  // deleting it products.delete; with neither its row is not pressed.
  const actionsOf = (service: Product): ActionItem[] => [
    ...(allowed("products.edit")
      ? [
          { label: "Tahrirlash", onSelect: () => setEditing(service) },
          { label: service.is_active ? "Nofaol qilish" : "Faollashtirish", onSelect: () => toggle.mutate(service) },
        ]
      : []),
    ...(allowed("products.delete") ? [{ label: "O'chirish", danger: true, onSelect: () => setDeleting(service) }] : []),
  ]
  const canAct = allowed("products.edit") || allowed("products.delete")

  // Until the session is known to be let in there is nothing to show; a
  // stranger is on their way home.
  if (!gate) return null
  const page = products.data
  return (
    <>
      <PageTitle
        title={plural}
        description={activeCount !== undefined ? `${whose} · ${activeCount} ta` : whose}
        action={canAdd && <PlusButton label={`${noun} qo'shish`} onClick={() => setAdding(true)} />}
      />
      <SectionTabs item={productsSection} permissions={gate.permissions} />
      <SearchBox value={filter.search} onSearch={(search) => update({ search })} placeholder={isProduct ? "Nom yoki artikul" : "Nom"} />
      <ChoiceChips
        label="Holat"
        value={filter.status}
        onChange={(status) => update({ status: status === "inactive" ? "inactive" : "active" })}
        options={[
          { value: "active", label: "Faol", count: activeCount },
          { value: "inactive", label: "Nofaol", count: inactiveCount },
        ]}
      />
      {loading && <ListLoading rows={6} />}
      {products.isError && <Failed error={products.error} onRetry={() => products.refetch()} />}
      {!loading && !products.isError && page?.total === 0 && (
        <EmptyState
          icon={filter.search ? SearchIcon : PackageIcon}
          title={unfiltered ? `Hali ${noun.toLowerCase()} yo'q` : filter.search ? `${plural} topilmadi` : `Nofaol ${noun.toLowerCase()} yo'q`}
          description={
            unfiltered
              ? `Birinchi ${noun.toLowerCase()}ni «${noun} qo'shish» tugmasi orqali qo'shing.`
              : filter.search
                ? "Qidiruv yoki filtrni o'zgartirib ko'ring."
                : undefined
          }
        />
      )}
      {!loading && !products.isError && page && page.total > 0 && (
        <>
          <Group label={plural} inset="icon" className={cn(products.isPlaceholderData && "opacity-60")}>
            {page.items.map((p) => {
              const currency = currencyOf(currencies, p.currency_id)
              const price = p.price ? formatAmount(p.price) : null
              const media = <Avatar name={p.name} square letter />
              const none = <span className="text-muted-foreground">—</span>
              if (isProduct) {
                const unit = p.unit ? unitLabel(p.unit) : null
                const sub = [unit, p.sku, p.quantity !== null ? `qoldiq ${formatQuantity(p.quantity, p.unit)}` : null].filter(Boolean).join(" · ")
                return (
                  <Row
                    key={p.id}
                    href={`/products/${p.id}`}
                    media={media}
                    title={p.name}
                    sub={sub || undefined}
                    end={price ?? none}
                    endSub={price ? (unit ? `${currency.symbol} / ${unit}` : currency.symbol) : undefined}
                    chevron={false}
                  />
                )
              }
              return (
                <Row
                  key={p.id}
                  onClick={canAct ? () => setActing(p) : undefined}
                  media={media}
                  title={p.name}
                  sub={p.note ?? `Qo'shilgan ${formatDate(p.created_at)}`}
                  end={price ?? none}
                  endSub={price ? currency.symbol : undefined}
                  chevron={false}
                />
              )
            })}
          </Group>
          {page.total > page.page_size ? (
            <Pager page={page.page} pageSize={page.page_size} total={page.total} onPage={(next) => update({ page: next })} />
          ) : (
            <Foot>Jami: {page.total}</Foot>
          )}
        </>
      )}
      <ActionSheet
        open={acting !== null}
        onOpenChange={(open) => !open && setActing(null)}
        title={acting ? (acting.price ? `${acting.name} · ${formatMoney(acting.price, currencyOf(currencies, acting.currency_id))}` : acting.name) : undefined}
        items={acting ? actionsOf(acting) : []}
      />
      {adding &&
        companyId !== null &&
        (isProduct ? (
          <ProductDialog companyId={companyId} open onOpenChange={(open) => !open && setAdding(false)} />
        ) : (
          <ServiceDialog companyId={companyId} open onOpenChange={(open) => !open && setAdding(false)} />
        ))}
      {editing && companyId !== null && (
        <ServiceDialog companyId={companyId} service={editing} open onOpenChange={(open) => !open && setEditing(null)} />
      )}
      {deleting && companyId !== null && (
        <DeleteProductDialog companyId={companyId} product={deleting} open onOpenChange={(open) => !open && setDeleting(null)} />
      )}
    </>
  )
}
