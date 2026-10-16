"use client"

import { ChevronLeftIcon, LogOutIcon, MoonIcon, SunIcon } from "lucide-react"
import Link from "next/link"
import { useTheme } from "next-themes"
import { useState } from "react"
import { useBackTarget } from "@/components/kit/back-target"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { moveTo } from "@/lib/moves"
import { useLogout } from "@/lib/queries"
import { useMiniApp } from "@/lib/telegram"
import { cn } from "@/lib/utils"

// A tool of the bar: a 40px pill, its icon (and words) in the heading's ink.
const tool =
  "inline-flex h-10 items-center gap-2 rounded-[20px] px-3 text-md text-heading outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-5"

// TopBar stands over the page's column on a wide screen, as the prototype's
// web view: a fade of the page's own color that what scrolls up passes
// under; at its left «Orqaga», a small glass, where the page's own way back
// leads (a phone's link, hidden here); at its right, in a browser, the
// theme (the moon to the dark, the sun to the light) and the way out, which
// asks first. Inside Telegram the chat sets the theme and closing the Mini
// App is the way out. The app speaks Uzbek alone: no language to choose.
export function TopBar() {
  const back = useBackTarget()
  const miniApp = useMiniApp()
  const { resolvedTheme, setTheme } = useTheme()
  const logout = useLogout()
  const [leaving, setLeaving] = useState(false)
  const dark = resolvedTheme === "dark"

  return (
    <div
      data-slot="top-bar"
      className="pointer-events-none absolute inset-x-0 top-0 z-[15] hidden h-[76px] items-center gap-1 bg-[linear-gradient(var(--fade)_55%,transparent)] px-[max(32px,calc((100%-1120px)/2))] md:flex [&>*]:pointer-events-auto"
    >
      {back && (
        <Link href={back.href} onClick={() => moveTo("back")} className={cn(tool, "glass-chip font-semibold text-foreground")}>
          <ChevronLeftIcon aria-hidden="true" strokeWidth={1.8} />
          Orqaga
        </Link>
      )}
      <span className="flex-1" />
      {!miniApp && (
        <>
          <button type="button" aria-label="Mavzuni almashtirish" onClick={() => setTheme(dark ? "light" : "dark")} className={cn(tool, "hover:bg-muted")}>
            {dark ? <SunIcon aria-hidden="true" strokeWidth={1.8} /> : <MoonIcon aria-hidden="true" strokeWidth={1.8} />}
          </button>
          <button type="button" aria-label="Chiqish" onClick={() => setLeaving(true)} className={cn(tool, "hover:bg-muted")}>
            <LogOutIcon aria-hidden="true" strokeWidth={1.8} />
          </button>
          <AlertDialog open={leaving} onOpenChange={setLeaving}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Tizimdan chiqasizmi?</AlertDialogTitle>
                <AlertDialogDescription>Qayta kirish uchun raqamingizga kod keladi.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel size="lg">Bekor qilish</AlertDialogCancel>
                <Button variant="destructive" size="lg" disabled={logout.isPending} onClick={() => logout.mutate()}>
                  Chiqish
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  )
}
