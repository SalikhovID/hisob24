"use client"

import { CircleCheckIcon, MapPinIcon, SearchIcon, SlidersHorizontalIcon } from "lucide-react"
import Link from "next/link"
import { Fragment, useCallback, useEffect, useRef, useState } from "react"
import { Chip, ChoiceChips, Chips } from "@/components/kit/chips"
import { Foot, Group, SectionHeading } from "@/components/kit/group"
import { MainButton } from "@/components/kit/main-button"
import { PageTitle, PlusButton } from "@/components/kit/page-title"
import { PickerSheet } from "@/components/kit/picker-sheet"
import { SearchBox } from "@/components/kit/search-box"
import { Segmented } from "@/components/kit/segmented"
import { Pager } from "@/components/pager"
import { settingsHref } from "@/components/settings/use-settings-tab"
import { EmptyState, Failed, ListLoading } from "@/components/states"
import { shortName } from "@/lib/initials"
import { can } from "@/lib/permissions"
import { formatPhone } from "@/lib/phone"
import {
  type OrderFilter,
  useCustomerDropdowns,
  useCustomerTypes,
  useMembers,
  useOrders,
  useOrderStages,
  useOrderTypes,
} from "@/lib/queries"
import { bucketLabels, type DeadlineBucket, deadlineBucket } from "@/lib/orders"
import type { Permission, Order } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { useKept } from "@/lib/use-kept"
import { useLocation } from "@/lib/use-location"
import { cn } from "@/lib/utils"
import { OrderBoard } from "./order-board"
import { AddOrderDialog } from "./order-dialog"
import { OrderRow } from "./order-row"
import { type OrderView, useOrderFilter } from "./use-order-filter"

const buckets: DeadlineBucket[] = ["late", "today", "week", "later", "done"]

// OrdersPage is the orders of the current location (logic/locations.md,
// section 6), for whoever may see them (orders.view; adding takes
// orders.create and customers.view, moving orders.edit), as the prototype's:
// a board of the stages (the first time) or a list grouped by how far the
// deadlines are (late, today, this week, later, done), a row each with its
// stage, customer, assignee and deadline; a chip per type, the assignee and
// (in the list) the stage chosen in sheets, a search by title, customer or
// phone. The heading says the location (with two or more) and how many
// orders it has.
export function OrdersPage() {
  const gate = usePermission("orders.view")
  const companyId = gate?.company.id ?? null
  const phone = gate?.user.phone ?? ""
  const allowed = (permission: Permission) => can(gate?.permissions, permission)
  const location = useLocation()
  const locationId = location.current?.id ?? null
  const types = useOrderTypes(companyId)
  const stages = useOrderStages(companyId)
  const dropdowns = useCustomerDropdowns(companyId)
  const customerTypes = useCustomerTypes(companyId)
  const members = useMembers(companyId)
  const [filter, update] = useOrderFilter()
  // The form for a new order, open for a stage (a column's +) or for the
  // first one (the page's +); null while closed.
  const [adding, setAdding] = useState<{ stageId: number | null } | null>(null)
  const [sheet, setSheet] = useState<null | "assignee" | "stage">(null)

  // The view is the address's; without one, the view chosen last time; the
  // first time, the board.
  const [kept, keep] = useKept(`orders_view:${companyId ?? 0}:${phone}`)
  const view: OrderView = filter.view ?? (kept === "list" ? "list" : "board")
  const changeView = (next: OrderView) => {
    keep(next)
    update({ view: next })
  }

  const listFilter: OrderFilter = {
    locationId,
    search: filter.search,
    typeId: filter.typeId,
    stageId: filter.stageId,
    assignee: filter.assignee,
    customerId: null,
    page: filter.page,
  }
  // The list is of the current location: nothing is asked until there is one.
  const orders = useOrders(view === "list" && locationId !== null ? companyId : null, listFilter)

  // Another location is another list: it starts from its first page. The
  // first location known is not a change.
  const shownLocation = useRef(locationId)
  useEffect(() => {
    const changed = shownLocation.current !== null && locationId !== null && shownLocation.current !== locationId
    shownLocation.current = locationId
    if (changed && filter.page > 1) update({ page: 1 })
  }, [locationId, filter.page, update])

  const stageOf = (order: Order) => stages.data?.find((stage) => stage.id === order.stage_id)
  const everyType = filter.typeId === null

  // The page needs the settings the orders are read with, and, as a list, the
  // orders. One that failed fails the page; trying again asks for them all.
  const queries = [types, stages, dropdowns, ...(view === "list" ? [orders] : [])]
  const failed = queries.find((query) => query.isError)
  // How many orders the location has is the unfiltered list's total: under a
  // filter the API counts the matches only. The total is kept from the last
  // unfiltered answer, so a filtered number never stands in for it. The
  // board has no stage filter: there every stage is a column.
  const unfiltered = everyType && !filter.assignee && !filter.search && (view === "board" || filter.stageId === null)
  const [total, setTotal] = useState<number>()
  if (unfiltered && orders.data && !orders.isPlaceholderData && orders.data.total !== total) {
    setTotal(orders.data.total)
  }
  // The board counts its columns up and tells the page, when nothing
  // narrows them.
  const onTotal = useCallback((sum: number | undefined) => {
    if (sum !== undefined) setTotal(sum)
  }, [])
  // The answer on screen while the next one loads is the previous filter's;
  // "nothing found" is not said of a filter that has not answered yet.
  const settling = orders.isPlaceholderData && orders.data?.total === 0
  const settingsAllowed = allowed("settings.view")
  const noStages = !failed && stages.data?.length === 0
  const noTypes = !failed && !noStages && types.data?.length === 0
  const loading = !failed && (queries.some((query) => query.isPending) || settling)
  const ready = companyId !== null && types.data && stages.data && dropdowns.data && types.data.length > 0 && stages.data.length > 0
  // An order is for a customer: adding one takes a way to the customers too,
  // and a location to enter it into.
  const canAdd = allowed("orders.create") && allowed("customers.view") && locationId !== null
  // A member with no location to work in sees no orders: the owner has to
  // give them one (logic/locations.md, section 5).
  const noLocation = location.ready && locationId === null
  // With two locations or more the page says which one it is.
  const where = location.locations.length >= 2 ? (location.current?.name ?? null) : null
  const count = unfiltered && total !== undefined ? `${total} ta` : null
  const description = [where, count].filter(Boolean).join(" · ") || undefined

  // The assignees are the company's members now, the signed-in one first,
  // as «Men».
  const memberName = (memberPhone: string) => {
    const member = members.data?.find((candidate) => candidate.phone === memberPhone)
    return member?.full_name ?? formatPhone(memberPhone)
  }
  const assigneeOptions = (members.data ?? [])
    .slice()
    .sort((a, b) => Number(b.phone === phone) - Number(a.phone === phone))
    .map((member) => ({ value: member.phone, label: member.phone === phone ? "Men" : (member.full_name ?? formatPhone(member.phone)) }))
  const assigneeLabel = filter.assignee === "" ? "Barcha mas'ullar" : filter.assignee === phone ? "Men" : shortName(memberName(filter.assignee))
  const stageLabel = filter.stageId === null ? "Barcha bosqichlar" : (stages.data?.find((stage) => stage.id === filter.stageId)?.name ?? "Bosqich")

  // Until the session is known to be let in there is nothing to show; a
  // stranger is on their way home.
  if (!gate) return null
  const page = orders.data
  const setupWhat = noStages ? "bosqichlar" : "buyurtma turlari"
  return (
    <>
      <PageTitle
        title="Buyurtmalar"
        description={description}
        action={ready && canAdd && <PlusButton label="Buyurtma qo'shish" onClick={() => setAdding({ stageId: null })} />}
      />
      {noLocation ? (
        <EmptyState icon={MapPinIcon} title="Sizga lokatsiya biriktirilmagan" description="Kompaniya egasi lokatsiya biriktirishi kerak." />
      ) : noStages || noTypes ? (
        // An order stands in a stage and is of a type: with none there is
        // nothing to enter. Both are the settings' to make.
        <EmptyState
          icon={SlidersHorizontalIcon}
          title="Sozlama yetishmaydi"
          description={settingsAllowed ? `Avval ${setupWhat}ni sozlang.` : `Kompaniya egasi ${setupWhat}ni sozlashi kerak.`}
          action={
            settingsAllowed && (
              <Link href={settingsHref("orders")} className="inline-flex h-[46px] items-center rounded-full glossy px-[22px] text-[16px] font-semibold">
                Sozlamalarni ochish
              </Link>
            )
          }
        />
      ) : (
        <>
          {types.data && stages.data && (
            <>
              <Segmented
                label="Ko'rinish"
                value={view}
                onChange={(next) => changeView(next === "list" ? "list" : "board")}
                options={[
                  { value: "board", label: "Kanban" },
                  { value: "list", label: "Ro'yxat" },
                ]}
              />
              <SearchBox value={filter.search} onSearch={(search) => update({ search })} placeholder="Nomi, mijoz yoki telefon" />
              <Chips>
                <ChoiceChips
                  bare
                  label="Buyurtma turi"
                  value={filter.typeId === null ? "all" : String(filter.typeId)}
                  onChange={(value) => update({ typeId: value === "all" ? null : Number(value) })}
                  options={[{ value: "all", label: "Barchasi" }, ...types.data.map((type) => ({ value: String(type.id), label: type.name }))]}
                />
                <Chip pressed={filter.assignee !== ""} chevron onClick={() => setSheet("assignee")}>
                  {assigneeLabel}
                </Chip>
                {view === "list" && (
                  <Chip pressed={filter.stageId !== null} chevron onClick={() => setSheet("stage")}>
                    {stageLabel}
                  </Chip>
                )}
              </Chips>
              <PickerSheet
                open={sheet === "assignee"}
                onOpenChange={(open) => setSheet(open ? "assignee" : null)}
                title="Mas'ul"
                options={assigneeOptions}
                value={filter.assignee}
                onChange={(assignee) => update({ assignee })}
                none="Barcha mas'ullar"
              />
              <PickerSheet
                open={sheet === "stage"}
                onOpenChange={(open) => setSheet(open ? "stage" : null)}
                title="Bosqich"
                options={stages.data.map((stage) => ({ value: String(stage.id), label: stage.name }))}
                value={filter.stageId === null ? "" : String(filter.stageId)}
                onChange={(value) => update({ stageId: value === "" ? null : Number(value) })}
                none="Barcha bosqichlar"
              />
            </>
          )}
          {view === "board" && ready && locationId !== null && (
            <OrderBoard
              companyId={companyId}
              phone={phone}
              stages={stages.data}
              types={types.data}
              everyType={everyType}
              filter={{ locationId, search: filter.search, typeId: filter.typeId, assignee: filter.assignee }}
              onTotal={onTotal}
              onAdd={(stageId) => setAdding({ stageId })}
              canAdd={canAdd}
              canMove={allowed("orders.edit")}
            />
          )}
          {view === "list" && loading && <ListLoading rows={6} mark="none" />}
          {failed?.error && <Failed error={failed.error} onRetry={() => queries.forEach((query) => query.refetch())} />}
          {view === "list" && !loading && !failed && page?.total === 0 && (
            <EmptyState
              icon={unfiltered ? CircleCheckIcon : SearchIcon}
              title={unfiltered ? "Hali buyurtma yo'q" : "Buyurtmalar topilmadi"}
              description={unfiltered ? "Birinchi buyurtmani «Buyurtma qo'shish» tugmasi orqali qo'shing." : "Qidiruv yoki filtrni o'zgartirib ko'ring."}
              action={
                unfiltered &&
                ready &&
                canAdd && (
                  <MainButton onClick={() => setAdding({ stageId: null })} className="px-5">
                    Buyurtma qo&apos;shish
                  </MainButton>
                )
              }
            />
          )}
          {view === "list" && !loading && !failed && page && page.total > 0 && (
            <section aria-label="Buyurtmalar" className={cn(orders.isPlaceholderData && "opacity-60")}>
              {buckets.map((bucket) => {
                const items = page.items.filter((order) => deadlineBucket(order.deadline, stageOf(order)?.is_done ?? false) === bucket)
                if (items.length === 0) return null
                return (
                  <Fragment key={bucket}>
                    <SectionHeading hint={String(items.length)}>{bucketLabels[bucket]}</SectionHeading>
                    <Group label={bucketLabels[bucket]} inset="icon">
                      {items.map((order) => (
                        <OrderRow key={order.id} order={order} stage={stageOf(order)} showStage showCustomer />
                      ))}
                    </Group>
                  </Fragment>
                )
              })}
              {page.total > page.page_size ? (
                <Pager page={page.page} pageSize={page.page_size} total={page.total} onPage={(next) => update({ page: next })} />
              ) : (
                <Foot>Jami: {page.total}</Foot>
              )}
            </section>
          )}
        </>
      )}
      {adding && ready && locationId !== null && (
        <AddOrderDialog
          companyId={companyId}
          locationId={locationId}
          types={types.data}
          stages={stages.data}
          customerTypes={customerTypes.data ?? []}
          canCreateCustomer={allowed("customers.create")}
          canPickProducts={allowed("products.view")}
          locationName={location.current?.name}
          dropdowns={dropdowns.data}
          members={members.data ?? []}
          typeId={filter.typeId}
          stageId={adding.stageId}
          onClose={() => setAdding(null)}
        />
      )}
    </>
  )
}
