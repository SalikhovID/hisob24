import type { ReactNode } from "react"
import { AppShell } from "@/components/shell/app-shell"

// Every page of the app proper opens inside the shell: the sections, the top
// bar and the gate that lets in only a session with a company. The login,
// the company list and /expired stand outside it.
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>
}
