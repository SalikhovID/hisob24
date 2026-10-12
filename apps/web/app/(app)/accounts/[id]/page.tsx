import type { Metadata } from "next"
import { AccountPage } from "@/components/finance/account-page"

export const metadata: Metadata = { title: "Akkaunt — Hisob24" }

export default async function AccountRoute({ params }: PageProps<"/accounts/[id]">) {
  const { id } = await params
  return <AccountPage id={Number(id)} />
}
