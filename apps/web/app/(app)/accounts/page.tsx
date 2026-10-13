import type { Metadata } from "next"
import { AccountsPage } from "@/components/finance/accounts-page"
import { PageTransition } from "@/components/kit/page-transition"

export const metadata: Metadata = { title: "Kassa — Hisob24" }

// The company's accounts with what each holds; the page opens inside the app's shell.
export default function AccountsRoute() {
  return (
    <PageTransition>
      <AccountsPage />
    </PageTransition>
  )
}
