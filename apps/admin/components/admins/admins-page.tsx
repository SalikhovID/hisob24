"use client"

import { type Column, DataList } from "@/components/data-list"
import { Identity } from "@/components/identity"
import { PageHeader } from "@/components/page-header"
import { Failed, ListLoading } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/format"
import { useAdmins, useMe } from "@/lib/queries"
import type { AdminAccount } from "@/lib/types"
import { AddAdminDialog } from "./add-admin-dialog"
import { DeleteAdminButton } from "./delete-admin-button"

// AdminsPage lists the platform's admins, active or not: one who was turned
// off stays in the list, stepped back, and can be added again.
export function AdminsPage() {
  const admins = useAdmins()
  const me = useMe()

  const columns: Column<AdminAccount>[] = [
    {
      header: "Ism",
      primary: true,
      // An admin with no name goes by the ID, which then is not said twice.
      cell: (a) => (
        <Identity
          title={a.full_name ?? `Telegram ID ${a.telegram_id}`}
          subtitle={a.full_name ? `Telegram ID ${a.telegram_id}` : undefined}
          name={a.full_name}
          seed={a.telegram_id}
          mark={a.telegram_id === me.data?.telegram_id && <Badge variant="outline">Siz</Badge>}
          muted={!a.is_active}
        />
      ),
    },
    {
      header: "Holat",
      card: "tag",
      cell: (a) =>
        a.is_active ? (
          <Badge variant="secondary">Faol</Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            Nofaol
          </Badge>
        ),
    },
    { header: "Qo'shilgan", card: "inline", className: "text-muted-foreground", cell: (a) => formatDate(a.created_at) },
    {
      header: "Amallar",
      actions: true,
      // Only another active admin can be turned off; the API refuses the rest.
      cell: (a) => me.data && a.is_active && a.telegram_id !== me.data.telegram_id && <DeleteAdminButton admin={a} />,
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Adminlar"
        description={admins.data ? `Platforma adminlari · ${admins.data.length} kishi` : "Platforma adminlari"}
        actions={<AddAdminDialog />}
      />
      {admins.isPending && <ListLoading />}
      {admins.isError && <Failed error={admins.error} onRetry={() => admins.refetch()} />}
      {admins.data && (
        <DataList
          label="Adminlar"
          items={admins.data}
          columns={columns}
          getKey={(a) => a.telegram_id}
          footer={`Jami: ${admins.data.length}`}
        />
      )}
    </div>
  )
}
