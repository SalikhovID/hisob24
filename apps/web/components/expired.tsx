"use client"

import { CalendarXIcon, LogOutIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useLogout, useSwitchCompany } from "@/lib/queries"

// Expired is where a session for a company whose subscription is over lands.
// The way on is another company: the session drops this one first, so the
// company list loads without a 402.
export function Expired() {
  const router = useRouter()
  const switchCompany = useSwitchCompany()
  const logout = useLogout()

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <CalendarXIcon className="size-6" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">Obuna muddati tugagan</h1>
          <p className="text-sm text-muted-foreground">
            Kompaniya obunasini uzaytirish uchun administrator bilan bog&apos;laning.
          </p>
        </div>
        {switchCompany.isError && (
          <p role="alert" className="text-sm text-destructive">
            {switchCompany.error.message}
          </p>
        )}
        <div className="grid gap-2">
          <Button
            disabled={switchCompany.isPending}
            onClick={() => switchCompany.mutate(null, { onSuccess: () => router.replace("/select-company") })}
          >
            Boshqa kompaniyani tanlash
          </Button>
          <Button variant="ghost" disabled={logout.isPending} onClick={() => logout.mutate()}>
            <LogOutIcon />
            Chiqish
          </Button>
        </div>
      </div>
    </main>
  )
}
