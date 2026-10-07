import { Fact } from "@/components/facts"
import { formatQuantity } from "@/lib/format"
import type { StockLine } from "@/lib/types"

// ProductStock is the product's stock in each of the member's locations
// (logic/products.md, section 6): every location is listed, with 0 too, in
// the order the locations were added.
export function ProductStock({ stock, unit }: { stock: StockLine[]; unit: string | null }) {
  return (
    <section aria-labelledby="product-stock" className="space-y-3">
      <h2 id="product-stock" className="text-base font-semibold">
        Qoldiq
      </h2>
      <dl className="divide-y rounded-xl border bg-card tabular-nums">
        {stock.map((line) => (
          <Fact key={line.location_id} name={line.location_name} value={formatQuantity(line.quantity, unit)} />
        ))}
      </dl>
    </section>
  )
}
