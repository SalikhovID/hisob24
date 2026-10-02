"use client"

import { CalendarXIcon } from "lucide-react"

// Expired is where a session for a company whose subscription is over lands.
export function Expired() {
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
      </div>
    </main>
  )
}
