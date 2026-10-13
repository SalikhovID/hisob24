"use client"

import { CalendarXIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { MainBar, MainButton } from "@/components/kit/main-button"
import { ShellLess } from "@/components/shell-less"
import { StateScreen } from "@/components/states"
import { useLogout, useSwitchCompany } from "@/lib/queries"
import { useMiniApp } from "@/lib/telegram"

// Expired is where a session for a company whose subscription is over
// lands, as the prototype's state screen: the red calendar, why, and the way
// on, another company (the session drops this one first, so the company
// list loads without a 402). In a browser the way out is there too.
export function Expired() {
  const router = useRouter()
  const switchCompany = useSwitchCompany()
  const logout = useLogout()
  const miniApp = useMiniApp()

  return (
    <ShellLess>
      <StateScreen
        icon={CalendarXIcon}
        tone="red"
        title="Obuna muddati tugagan"
        description="Kompaniya obunasini uzaytirish uchun administrator bilan bog'laning."
      >
        <MainBar className="md:items-center">
          {switchCompany.isError && (
            <p role="alert" className="pb-2 text-center text-md text-destructive">
              {switchCompany.error.message}
            </p>
          )}
          <MainButton
            pending={switchCompany.isPending}
            onClick={() => switchCompany.mutate(null, { onSuccess: () => router.replace("/select-company") })}
          >
            Boshqa kompaniyani tanlash
          </MainButton>
          {!miniApp && (
            <MainButton variant="ghost" pending={logout.isPending} onClick={() => logout.mutate()}>
              Chiqish
            </MainButton>
          )}
        </MainBar>
      </StateScreen>
    </ShellLess>
  )
}
