import type { ReactNode } from "react"
import { Logo } from "@/components/logo"

// ShellLess is a screen with no shell around it (an expired subscription,
// the Mini App's sign-in and why it could not be): as tall as the screen,
// Hisob24's logo at its head (in a full-screen Mini App under what Telegram
// lays over the top), what it says under it. The splash goes without the
// logo: its mark is Hisob24's.
export function ShellLess({ logo = true, children }: { logo?: boolean; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col px-4 pt-safe-6">
      {logo && <Logo className="mx-auto h-6 shrink-0" />}
      {children}
    </main>
  )
}
