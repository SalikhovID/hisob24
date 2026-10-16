import { MapPinIcon } from "lucide-react"
import { SectionHeading } from "@/components/kit/group"
import { Badge } from "@/components/ui/badge"
import { formatQuantity } from "@/lib/format"
import type { StockLine } from "@/lib/types"
import { cn } from "@/lib/utils"

// ProductStock is the product's stock in each of the member's locations
// (logic/products.md, section 6), as the prototype's glass cards: every location
// is there, with 0 too, in the order the locations were added; the current
// one is marked «Joriy».
export function ProductStock({ stock, unit, currentId }: { stock: StockLine[]; unit: string | null; currentId: number | null }) {
  return (
    <section aria-label="Qoldiq">
      <SectionHeading>Qoldiq</SectionHeading>
      <dl className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {stock.map((line) => {
          const current = line.location_id === currentId
          return (
            <div key={line.location_id} className="flex min-h-[104px] flex-col rounded-group surface px-3.5 py-3.5">
              <dt className="flex flex-wrap items-center gap-1.5 text-md font-medium">
                <span aria-hidden="true" className={cn("grid size-5 place-items-center rounded-full text-white", current ? "bg-primary" : "bg-muted-foreground")}>
                  <MapPinIcon strokeWidth={2.8} className="size-3" />
                </span>
                {line.location_name}
                {current && (
                  <>
                    {" "}
                    <Badge variant="accent">Joriy</Badge>
                  </>
                )}
              </dt>
              <dd className="mt-auto pt-2 text-[22px] leading-tight font-bold tracking-[-0.02em] tabular-nums">{formatQuantity(line.quantity, unit)}</dd>
            </div>
          )
        })}
      </dl>
    </section>
  )
}
