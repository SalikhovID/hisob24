"use client"

import { QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "next-themes"
import { type ReactNode, useState } from "react"
import { TelegramSync } from "@/components/telegram-sync"
import { Toaster } from "@/components/ui/sonner"
import { makeQueryClient } from "@/lib/query-client"

// Providers wraps every page: the light/dark theme, the query client (a 401
// leads to /login), the Mini App fit and the toasts.
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => makeQueryClient())
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <TelegramSync />
        {children}
        <Toaster position="top-center" richColors />
      </QueryClientProvider>
    </ThemeProvider>
  )
}
