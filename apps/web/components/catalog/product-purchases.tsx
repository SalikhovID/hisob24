"use client"

import { ReceiptIcon } from "lucide-react"
import { useState } from "react"
import { Group, Row, SectionHeading } from "@/components/kit/group"
import { SoftIcon } from "@/components/kit/tile-icon"
import { Pager } from "@/components/pager"
import { Failed, ListLoading } from "@/components/states"
import { currencyOf, useCurrencies } from "@/lib/currencies"
import { formatDateTime, formatMoney, formatQuantity } from "@/lib/format"
import { useProductPurchases } from "@/lib/queries"
import { useLocation } from "@/lib/use-location"

// ProductPurchases is the live purchases a product is in, on its page, in
// the member's locations, as the prototype's rows: each by its number and
// supplier (the way into the purchase), the moment, its location (with two
// or more to work in), the quantity bought at what price, and what the line
// came to in the purchase's currency; the newest first, twenty at a time.
export function ProductPurchases({ companyId, productId, unit }: { companyId: number; productId: number; unit: string | null }) {
  const [page, setPage] = useState(1)
  const purchases = useProductPurchases(companyId, productId, page)
  const { locations } = useLocation()
  const currencies = useCurrencies()
  const data = purchases.data
  return (
    <section aria-labelledby="product-purchases">
      <SectionHeading hint={data && data.total > 0 ? data.total : undefined}>
        <span id="product-purchases">Xaridlar</span>
      </SectionHeading>
      {purchases.isPending && <ListLoading rows={2} mark="none" />}
      {purchases.isError && <Failed error={purchases.error} onRetry={() => purchases.refetch()} />}
      {data?.total === 0 && (
        <Group>
          <p className="px-4 py-3.5 text-md text-muted-foreground">Bu mahsulot hali xarid qilinmagan</p>
        </Group>
      )}
      {data && data.total > 0 && (
        <>
          <Group label="Xaridlar" inset="icon">
            {data.items.map((line) => {
              const currency = currencyOf(currencies, line.currency_id)
              const sub = [
                formatDateTime(line.at),
                locations.length >= 2 ? line.location_name : null,
                `${formatQuantity(line.quantity, unit)} × ${formatMoney(line.price, currency)}`,
              ]
              return (
                <Row
                  key={line.purchase_id}
                  href={`/purchases/${line.purchase_id}`}
                  media={<SoftIcon icon={ReceiptIcon} />}
                  title={`№ ${line.number} · ${line.supplier.name}`}
                  sub={sub.filter(Boolean).join(" · ")}
                  end={formatMoney(line.amount, currency)}
                  chevron={false}
                />
              )
            })}
          </Group>
          {data.total > data.page_size && <Pager page={data.page} pageSize={data.page_size} total={data.total} onPage={setPage} />}
        </>
      )}
    </section>
  )
}
