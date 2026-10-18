"use client"

import { useQueryClient } from "@tanstack/react-query"
import { BanknoteIcon, ClipboardListIcon, PencilIcon, PhoneIcon, UserIcon } from "lucide-react"
import { type CSSProperties, useState } from "react"
import { toast } from "sonner"
import { Avatar } from "@/components/kit/avatar"
import { DetailHead, Tile, Tiles } from "@/components/kit/detail-head"
import { Group, KeyValue, Row, SectionHeading } from "@/components/kit/group"
import { BackLink, PageTitle } from "@/components/kit/page-title"
import { Failed, ListLoading, NotFound } from "@/components/states"
import { ApiError } from "@/lib/api"
import { customerName } from "@/lib/customers"
import { answerText } from "@/lib/fields"
import { UZS } from "@/lib/currencies"
import { formatDate } from "@/lib/format"
import { orderName } from "@/lib/orders"
import { can } from "@/lib/permissions"
import { formatPhone } from "@/lib/phone"
import {
  orderHistoryKey,
  useCustomer,
  useCustomerDropdowns,
  useCustomerTypes,
  useMembers,
  useMoveOrder,
  useOrder,
  useOrderStages,
  useOrderTypes,
} from "@/lib/queries"
import { colorValues } from "@/lib/stage-colors"
import type { Permission } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { useLocation } from "@/lib/use-location"
import { DeadlineCard } from "./deadline-card"
import { DeleteOrderButton } from "./delete-order-button"
import { EditOrderDialog } from "./edit-order-dialog"
import { StageBadge } from "./stage-badge"
import { StageTrack } from "./stage-track"
import { OrderHistory } from "./order-history"
import { OrderLines } from "./order-lines"
import { OrderMoneyCard } from "./order-money-card"
import { OrderPayments } from "./order-payments"
import { PaymentDialog } from "@/components/warehouse/payment-dialog"

const back = { href: "/orders", label: "Buyurtmalar" }

// OrderPage is one order of the company, for whoever may see the orders
// (changing, moving, deleting and the history each take their permission),
// as the prototype's page: what it is (its stage's tile, its name (its number), its type
// and customer), its stage on a track of all of them (moved right here), its
// deadline, the tiles (editing, a payment, the customer, a call to the customer), its money, the
// customer's row, its answer to every field of its type in the type's order
// with who entered it and when, its goods and its payments (logic/orders.md, 4.3), its history, and at the foot the way to
// delete it.
export function OrderPage({ id }: { id: number }) {
  const gate = usePermission("orders.view")
  const companyId = gate?.company.id ?? null
  const allowed = (permission: Permission) => can(gate?.permissions, permission)
  const order = useOrder(companyId, id)
  const types = useOrderTypes(companyId)
  const stages = useOrderStages(companyId)
  const dropdowns = useCustomerDropdowns(companyId)
  const members = useMembers(companyId)
  const customerTypes = useCustomerTypes(companyId)
  // The customer is asked for once the order names it: its type is told
  // beside its name.
  const customer = useCustomer(order.data ? companyId : null, order.data?.customer.id ?? 0)
  const move = useMoveOrder(companyId)
  const queryClient = useQueryClient()
  // With two or more locations to work in the page says the order's one.
  const { locations } = useLocation()
  const [editing, setEditing] = useState(false)
  const [paying, setPaying] = useState(false)

  // An order that is gone, or is another company's, is not found: there is
  // nothing to try again.
  if (order.error instanceof ApiError && order.error.status === 404) {
    return (
      <>
        <BackLink {...back} />
        <NotFound title="Buyurtma topilmadi" description="Bu buyurtma o'chirilgan yoki sizning kompaniyangizniki emas." />
      </>
    )
  }
  // The page needs the order and what it is read with. One that failed fails
  // the page; trying again asks for them all.
  const queries = [order, types, stages, dropdowns]
  const failed = queries.find((query) => query.isError)
  if (!order.data || !types.data || !stages.data || !dropdowns.data || companyId === null) {
    return (
      <>
        <PageTitle title="Buyurtma" back={back} />
        {failed?.error ? (
          <Failed error={failed.error} onRetry={() => queries.forEach((query) => query.refetch())} />
        ) : (
          <ListLoading rows={4} mark="none" />
        )}
      </>
    )
  }
  const type = types.data.find((candidate) => candidate.id === order.data.type_id)
  const stage = stages.data.find((candidate) => candidate.id === order.data.stage_id)
  const done = stage?.is_done ?? false
  const customerType = customer.data ? customerTypes.data?.find((candidate) => candidate.id === customer.data.type_id) : undefined
  const name = customer.data ? customerName(customer.data, customerType) : order.data.customer.name
  const phone = formatPhone(order.data.customer.phone)
  const customerHref = allowed("customers.view") ? `/customers/${order.data.customer.id}` : undefined

  return (
    <>
      <BackLink {...back} />
      <DetailHead
        media={
          <span
            aria-hidden="true"
            style={{ "--c": stage ? colorValues[stage.color] : "var(--muted-foreground)" } as CSSProperties}
            className="grid size-[76px] place-items-center rounded-[24px] bg-[color-mix(in_srgb,var(--c)_16%,transparent)] text-[color-mix(in_srgb,var(--c)_62%,var(--foreground))]"
          >
            <ClipboardListIcon strokeWidth={1.9} className="size-9" />
          </span>
        }
        title={orderName(order.data.number)}
        description={[type?.name, name ?? phone].filter(Boolean).join(" · ")}
      />
      <StageTrack
        stages={stages.data}
        value={order.data.stage_id}
        // The stage is changed right here, as on the board, by whoever may move orders.
        disabled={!allowed("orders.edit") || move.isPending}
        onChange={(stageId) =>
          move.mutate(
            { order: order.data, stageId },
            {
              onSuccess: () => {
                toast.success("Bosqich o'zgartirildi")
                queryClient.invalidateQueries({ queryKey: orderHistoryKey(companyId, id) })
              },
            },
          )
        }
      />
      <DeadlineCard deadline={order.data.deadline} done={done} />
      <Tiles>
        {type && allowed("orders.edit") && <Tile icon={PencilIcon} label="Tahrirlash" onClick={() => setEditing(true)} />}
        {/* A payment for the order, on its own (logic/orders.md, 4.3). */}
        {allowed("orders.edit") && <Tile icon={BanknoteIcon} label="To'lov" onClick={() => setPaying(true)} />}
        {customerHref && <Tile icon={UserIcon} label="Mijoz" href={customerHref} />}
        <Tile icon={PhoneIcon} label="Qo'ng'iroq" href={`tel:+${order.data.customer.phone}`} />
      </Tiles>
      <OrderMoneyCard order={order.data} />
      <section aria-label="Mijoz">
        <SectionHeading>Mijoz</SectionHeading>
        <Group label="Mijoz" inset="icon">
          {/* A customer with no name goes by the phone, which is then not said twice. */}
          <Row
            href={customerHref}
            media={<Avatar name={name} />}
            title={name ?? phone}
            sub={[customerType?.name, name ? phone : null].filter(Boolean).join(" · ") || undefined}
          />
        </Group>
      </section>
      <section aria-label="Ma'lumot">
        <SectionHeading>Ma&apos;lumot</SectionHeading>
        <Group as="dl">
          <KeyValue label="Turi" value={type?.name} />
          <KeyValue label="Bosqich" value={stage && <StageBadge stage={stage} />} />
          {locations.length >= 2 && <KeyValue label="Lokatsiya" value={locations.find((l) => l.id === order.data.location_id)?.name} />}
          <KeyValue label="Mas'ul" value={order.data.assignee && (order.data.assignee.full_name ?? formatPhone(order.data.assignee.phone))} />
          {type?.fields.map((field) => (
            <KeyValue key={field.id} label={field.label} value={answerText(field, order.data.values[field.id], dropdowns.data)} />
          ))}
          <KeyValue label="Qo'shgan" value={order.data.created_by_name} />
          <KeyValue label="Qo'shilgan" value={formatDate(order.data.created_at)} />
        </Group>
      </section>
      <OrderLines order={order.data} />
      <OrderPayments companyId={companyId} order={order.data} canEdit={allowed("orders.edit")} />
      {/* Who did what to the order takes its permission. */}
      {allowed("orders.history") && <OrderHistory companyId={companyId} id={order.data.id} />}
      {allowed("orders.delete") && <DeleteOrderButton companyId={companyId} id={order.data.id} title={orderName(order.data.number)} />}
      {editing && type && (
        <EditOrderDialog
          companyId={companyId}
          order={order.data}
          type={type}
          stages={stages.data}
          members={members.data ?? []}
          dropdowns={dropdowns.data}
          canPickProducts={allowed("products.view")}
          locationName={locations.find((l) => l.id === order.data.location_id)?.name}
          open
          onOpenChange={(open) => !open && setEditing(false)}
        />
      )}
      {paying && (
        <PaymentDialog
          party="customer"
          companyId={companyId}
          partyId={order.data.customer.id}
          orderId={order.data.id}
          partyName={orderName(order.data.number)}
          // What is left of the price is offered whole, in so'm.
          owed={order.data.currency_id === UZS && Number(order.data.amount) > 0 ? (Number(order.data.amount) - Number(order.data.paid)).toFixed(2) : null}
          open
          onOpenChange={(open) => !open && setPaying(false)}
        />
      )}
    </>
  )
}
