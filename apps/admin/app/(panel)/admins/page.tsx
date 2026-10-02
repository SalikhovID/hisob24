import type { Metadata } from "next"
import { AdminsPage } from "@/components/admins/admins-page"

export const metadata: Metadata = { title: "Adminlar — Hisob24 Admin" }

export default function Page() {
  return <AdminsPage />
}
