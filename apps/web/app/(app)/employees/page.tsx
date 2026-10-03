import type { Metadata } from "next"
import { EmployeesPage } from "@/components/employees/employees-page"

export const metadata: Metadata = { title: "Xodimlar — Hisob24" }

// The company's members, for its owner; it opens inside the app's shell.
export default function EmployeesRoute() {
  return <EmployeesPage />
}
