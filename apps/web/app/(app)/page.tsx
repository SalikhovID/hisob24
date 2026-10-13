import { Dashboard } from "@/components/dashboard"
import { PageTransition } from "@/components/kit/page-transition"

// The dashboard is the app's home page.
export default function Home() {
  return (
    <PageTransition>
      <Dashboard />
    </PageTransition>
  )
}
