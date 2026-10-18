"use client"

import { useState } from "react"
import { Foot, Group, SectionHeading } from "@/components/kit/group"
import { Pager } from "@/components/pager"
import { EmptyState, Failed, ListLoading } from "@/components/states"
import { OrderRow } from "@/components/orders/order-row"
import { useOrders, useOrderStages } from "@/lib/queries"
import { useLocation } from "@/lib/use-location"

// CustomerOrders is the orders a customer has, on its page, as the
// prototype's rows: each its title (the way into the order), its stage, its
// location (with two or more to work in: the customer's orders are of every
// one of them, whatever the current one), its assignee and its deadline,
// the one due soonest first, twenty at a time.
export function CustomerOrders({ companyId, customerId }: { companyId: number; customerId: number }) {
  const [page, setPage] = useState(1)
  const orders = useOrders(companyId, { locationId: null, search: "", typeId: null, stageId: null, assignee: "", customerId, page })
  const stages = useOrderStages(companyId)
  const { locations } = useLocation()
  const queries = [orders, stages]
  const failed = queries.find((query) => query.isError)
  const data = orders.data
  return (
    <section aria-label="Buyurtmalar">
      <SectionHeading>Buyurtmalar</SectionHeading>
      {!failed && queries.some((query) => query.isPending) && <ListLoading rows={2} mark="none" />}
      {failed?.error && <Failed error={failed.error} onRetry={() => queries.forEach((query) => query.refetch())} />}
      {!failed && data?.total === 0 && <EmptyState title="Bu mijozda buyurtma yo'q" />}
      {!failed && data && stages.data && data.total > 0 && (
        <>
          <Group label="Buyurtmalar" inset="icon">
            {data.items.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                stage={stages.data.find((stage) => stage.id === order.stage_id)}
                showStage
                locationName={locations.length >= 2 ? (locations.find((l) => l.id === order.location_id)?.name ?? null) : null}
              />
            ))}
          </Group>
          {data.total > data.page_size ? (
            <Pager page={data.page} pageSize={data.page_size} total={data.total} onPage={setPage} />
          ) : (
            <Foot>Jami: {data.total}</Foot>
          )}
        </>
      )}
    </section>
  )
}
