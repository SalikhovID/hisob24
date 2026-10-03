"use client"

import { type Column, DataList } from "@/components/data-list"
import { Identity } from "@/components/identity"
import { PageHeader } from "@/components/page-header"
import { Failed, Loading } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/format"
import { useAdmins, useMe } from "@/lib/queries"
import type { AdminAccount } from "@/lib/types"
import { AddAdminDialog } from "./add-admin-dialog"
import { DeleteAdminButton } from "./delete-admin-button"

// AdminsPage lists the platform's admins.
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
        />
      ),
    },
    {
      header: "Holat",
      card: "tag",
      cell: (a) => <Badge variant={a.is_active ? "secondary" : "outline"}>{a.is_active ? "Faol" : "Nofaol"}</Badge>,
    },
    { header: "Qo'shilgan", card: "inline", cell: (a) => formatDate(a.created_at) },
    {
      header: "Amallar",
      actions: true,
      // Only another active admin can be turned off; the API refuses the rest.
      cell: (a) => me.data && a.is_active && a.telegram_id !== me.data.telegram_id && <DeleteAdminButton admin={a} />,
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Adminlar"
        description={admins.data ? `Platforma adminlari · ${admins.data.length} kishi` : "Platforma adminlari"}
        actions={<AddAdminDialog />}
      />
      {admins.isPending && <Loading />}
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
