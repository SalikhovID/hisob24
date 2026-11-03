"use client"

import { PencilIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { Avatar } from "@/components/kit/avatar"
import { DataTable } from "@/components/kit/data-table"
import { Group, KeyValue, Row, SectionHeading } from "@/components/kit/group"
import { PageAction, PageActions } from "@/components/kit/page-actions"
import { BackLink, PageTitle } from "@/components/kit/page-title"
import { Failed, ListLoading, NotFound } from "@/components/states"
import { ApiError } from "@/lib/api"
import { formatDate, formatDateTime, formatQuantity } from "@/lib/format"
import { can } from "@/lib/permissions"
import { useInventory } from "@/lib/queries"
import { signedQuantity } from "@/lib/stock"
import type { Permission } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { useLocation } from "@/lib/use-location"
import { cn } from "@/lib/utils"
import { DeleteInventoryButton } from "./delete-inventory-button"
import { moving } from "@/lib/moves"

const back = { href: "/inventories", label: "Inventarizatsiya" }

// InventoryPage is one count of the member's locations (logic/warehouse.md,
// 5.2), for whoever may see the stock documents (changing and deleting
// each take their permission), as the prototype's page: its number over
// its moment and who entered it; the actions at the title's right (editing,
// deleting); its lines (on the web a table), each product with what the
// journal expected and what was counted and the difference (a surplus
// green, a shortage red); its facts.
export function InventoryPage({ id }: { id: number }) {
  const gate = usePermission("stock.view")
  const companyId = gate?.company.id ?? null
  const allowed = (permission: Permission) => can(gate?.permissions, permission)
  const inventory = useInventory(companyId, id)
  const { locations } = useLocation()
  const router = useRouter()

  if (!gate) return null
  if (inventory.error instanceof ApiError && inventory.error.status === 404) {
    return (
      <>
        <BackLink {...back} />
        <NotFound title="Inventarizatsiya topilmadi" description="Bu inventarizatsiya o'chirilgan yoki siz ishlamaydigan lokatsiyada." />
      </>
    )
  }
  if (!inventory.data || companyId === null) {
    return (
      <>
        <PageTitle title="Inventarizatsiya" back={back} />
        {inventory.isError ? <Failed error={inventory.error} onRetry={() => inventory.refetch()} /> : <ListLoading rows={4} mark="none" />}
      </>
    )
  }
  const i = inventory.data
  const actions = [
    allowed("stock.edit") && <PageAction key="edit" icon={PencilIcon} label="Tahrirlash" href={`/inventories/${i.id}/edit`} />,
    allowed("stock.delete") && <DeleteInventoryButton key="delete" companyId={companyId} inventory={i} afterDelete={() => moving("back", () => router.replace("/inventories"))} />,
  ].filter(Boolean)

  return (
    <>
      <PageTitle
        back={back}
        title={`Inventarizatsiya № ${i.number}`}
        description={`${formatDateTime(i.at)} · ${i.created_by_name}`}
        action={actions.length > 0 && <PageActions>{actions}</PageActions>}
      />
      <section aria-labelledby="inventory-lines">
        <SectionHeading hint={i.items.length}>
          <span id="inventory-lines">Mahsulotlar</span>
        </SectionHeading>
        <DataTable
          label="Mahsulotlar"
          rows={i.items}
          rowKey={(item) => item.product_id}
          href={(item) => `/products/${item.product_id}`}
          columns={[
            { key: "name", label: "Mahsulot", render: (item) => item.name },
            { key: "expected", label: "Tizimda", align: "end", render: (item) => formatQuantity(item.expected, item.unit) },
            { key: "counted", label: "Sanalgan", align: "end", render: (item) => formatQuantity(item.counted, item.unit) },
            { key: "difference", label: "Farq", align: "end", render: (item) => <Difference difference={item.difference} unit={item.unit} /> },
          ]}
          phone={
            <Group label="Mahsulotlar" inset="icon">
              {i.items.map((item) => (
                <Row
                  key={item.product_id}
                  href={`/products/${item.product_id}`}
                  media={<Avatar name={item.name} square letter />}
                  title={item.name}
                  sub={`tizim ${formatQuantity(item.expected, item.unit)} · sanalgan ${formatQuantity(item.counted, item.unit)}`}
                  end={<Difference difference={item.difference} unit={item.unit} />}
                  chevron={false}
                />
              ))}
            </Group>
          }
        />
      </section>
      <section aria-label="Ma'lumot">
        <SectionHeading>Ma&apos;lumot</SectionHeading>
        <Group as="dl">
          {locations.length >= 2 && <KeyValue label="Lokatsiya" value={i.location_name} />}
          <KeyValue label="Vaqt" value={formatDateTime(i.at)} />
          <KeyValue label="Izoh" value={i.note} />
          <KeyValue label="Qo'shgan" value={i.created_by_name} />
          <KeyValue label="Qo'shilgan" value={formatDate(i.created_at)} />
        </Group>
      </section>
    </>
  )
}

// Difference is what the count found against the journal, signed: a
// surplus green, a shortage red, none plain.
function Difference({ difference, unit }: { difference: string; unit: string | null }) {
  return (
    <span className={cn("tabular-nums", difference.startsWith("-") && "text-destructive", Number(difference) > 0 && "text-positive")}>
      {signedQuantity(difference, unit)}
    </span>
  )
}
