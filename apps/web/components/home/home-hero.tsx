import { Hero } from "@/components/kit/hero"
import { groupDigits } from "@/components/kit/amount"
import { Badge } from "@/components/ui/badge"
import type { Dashboard } from "@/lib/types"

// whole is a sum of so'm without its tiyins, grouped: "300 000".
const whole = (amount: string) => groupDigits(amount.split(".")[0])

// HomeHero heads the home with the one figure that matters most to the
// member, as the prototype does: what the suppliers are owed to whoever
// sees the purchases (how many owe, the advance), else the orders not done
// (how many are late, in which location), else how many customers there
// are. Each leads to its section. With none of them to see, there is none.
export function HomeHero({ dashboard, locationName }: { dashboard: Dashboard; locationName: string | null }) {
  const { suppliers, orders, customers } = dashboard
  if (suppliers) {
    const owed = suppliers.debtors > 0
    return (
      <Hero
        href="/suppliers"
        label="Ta'minotchilarga qarz"
        value={suppliers.debt}
        unit="so'm"
        badges={
          <>
            {owed ? <Badge variant="red">{suppliers.debtors} ta ta&apos;minotchi</Badge> : <Badge variant="green">Qarz yo&apos;q</Badge>}
            {Number(suppliers.advance) > 0 && <Badge variant="green">Avans {whole(suppliers.advance)}</Badge>}
          </>
        }
      />
    )
  }
  if (orders) {
    return (
      <Hero
        href="/orders"
        label="Faol buyurtmalar"
        value={String(orders.active)}
        unit="ta"
        badges={
          <>
            {orders.late > 0 ? <Badge variant="red">{orders.late} ta kechikkan</Badge> : <Badge variant="green">Hammasi vaqtida</Badge>}
            {locationName && <span className="font-medium text-muted-foreground">{locationName}</span>}
          </>
        }
      />
    )
  }
  if (customers) {
    return <Hero href="/customers" label="Mijozlar" value={String(customers.total)} unit="ta" />
  }
  return null
}
