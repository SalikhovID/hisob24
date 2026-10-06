import type { Metadata } from "next"
import { RolePage } from "@/components/settings/role-page"

// What a tab and a screen reader call the page: the kind of page it is (the
// role's own name is its heading).
export const metadata: Metadata = { title: "Rol — Hisob24" }

export default async function RoleRoute({ params }: PageProps<"/settings/roles/[id]">) {
  const { id } = await params
  return <RolePage id={Number(id)} />
}
