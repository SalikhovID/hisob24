"use client"

import { type Column, DataList } from "@/components/data-list"
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
    { header: "Ism", cell: (a) => a.full_name ?? "—", primary: true },
    { header: "Telegram ID", cell: (a) => <span className="font-mono">{a.telegram_id}</span> },
    {
      header: "Holat",
      cell: (a) => (
        <span className="inline-flex flex-wrap items-center justify-end gap-1">
          <Badge variant={a.is_active ? "secondary" : "outline"}>{a.is_active ? "Faol" : "Nofaol"}</Badge>
          {a.telegram_id === me.data?.telegram_id && <Badge>Siz</Badge>}
        </span>
      ),
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
