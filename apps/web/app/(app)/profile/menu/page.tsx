import type { Metadata } from "next"
import { MenuOrderPage } from "@/components/profile/menu-order-page"
import { PageTransition } from "@/components/kit/page-transition"

export const metadata: Metadata = { title: "Pastki menyu — Hisob24" }

// The order of the member's sections: the tab bar's and the sidebar's.
export default function MenuOrderRoute() {
  return (
    <PageTransition>
      <MenuOrderPage />
    </PageTransition>
  )
}
