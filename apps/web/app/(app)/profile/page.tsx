import type { Metadata } from "next"
import { ProfilePage } from "@/components/profile/profile-page"
import { PageTransition } from "@/components/kit/page-transition"

export const metadata: Metadata = { title: "Profil — Hisob24" }

// The profile: who is signed in, the company, the sections the tab bar does
// not hold, the order of the bar and the way out.
export default function ProfileRoute() {
  return (
    <PageTransition>
      <ProfilePage />
    </PageTransition>
  )
}
