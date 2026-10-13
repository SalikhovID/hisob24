import type { Metadata } from "next"
import { AccountPage } from "@/components/finance/account-page"
import { PageTransition } from "@/components/kit/page-transition"

export const metadata: Metadata = { title: "Akkaunt — Hisob24" }

export default async function AccountRoute({ params }: PageProps<"/accounts/[id]">) {
  const { id } = await params
  return (
    <PageTransition>
      <AccountPage id={Number(id)} />
    </PageTransition>
  )
}
