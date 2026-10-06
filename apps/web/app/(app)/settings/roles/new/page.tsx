import type { Metadata } from "next"
import { NewRolePage } from "@/components/settings/role-page"

export const metadata: Metadata = { title: "Yangi rol — Hisob24" }

// A role to be made by the company's owner; it opens inside the app's shell.
export default function NewRoleRoute() {
  return <NewRolePage />
}
