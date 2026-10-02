"use client"

import { useMutation } from "@tanstack/react-query"
import { LogOutIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { api, call } from "@/lib/api"
import { useMe } from "@/lib/queries"
import { useMiniApp } from "@/lib/telegram"

// Topbar is the bar above every page: who is signed in and the way out.
// Inside Telegram there is no sign-out: closing the Mini App is the way out,
// and opening it signs the admin in again.
export function Topbar() {
  const router = useRouter()
  const me = useMe()
  const miniApp = useMiniApp()
  const logout = useMutation({
    mutationFn: () => call(api.POST("/admin/auth/logout")),
    onSuccess: () => router.replace("/login"),
  })

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background px-4">
      <div className="ml-auto flex items-center gap-1">
        {me.data && (
          <span className="mr-1 truncate text-sm text-muted-foreground">
            {me.data.full_name ?? me.data.telegram_id}
          </span>
        )}
        {!miniApp && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Chiqish"
            disabled={logout.isPending}
            onClick={() => logout.mutate()}
          >
            <LogOutIcon />
          </Button>
        )}
      </div>
    </header>
  )
}
