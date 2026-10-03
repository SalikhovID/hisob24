"use client"

import { type Column, DataList } from "@/components/data-list"
import { Identity } from "@/components/identity"
import { Failed, Loading } from "@/components/states"
import { Badge } from "@/components/ui/badge"
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
      cell: (a) => <Badge variant={a.is_active ? "secondary" : "outline"}>{a.is_active ? "Faol" : "Nofaol"}</Badge>,
    },
    {
      header: "Amallar",
      // Only another active admin can be turned off; the API refuses the rest.
      cell: (a) => me.data && a.is_active && a.telegram_id !== me.data.telegram_id && <DeleteAdminButton admin={a} />,
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Adminlar</h1>
        <AddAdminDialog />
      </div>
      {admins.isPending && <Loading />}
      {admins.isError && <Failed error={admins.error} onRetry={() => admins.refetch()} />}
      {admins.data && <DataList label="Adminlar" items={admins.data} columns={columns} getKey={(a) => a.telegram_id} />}
    </div>
  )
}
