import type { Metadata, Viewport } from "next"
import { Geist } from "next/font/google"
import Script from "next/script"
import { Providers } from "@/components/providers"
import { cn } from "@/lib/utils"
import "./globals.css"

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })

export const metadata: Metadata = {
  title: "Hisob24",
  description: "Hisob24 — biznesingiz uchun hisob tizimi",
}

// The page may reach under a phone's edges: only then does the bottom tab
// bar learn, from env(safe-area-inset-bottom), how far the home indicator
// reaches up.
export const viewport: Viewport = { viewportFit: "cover" }

// suppressHydrationWarning: next-themes sets the theme class on <html>
// before React hydrates.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="uz" className={cn("font-sans", geist.variable)} suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      </body>
    </html>
  )
}
