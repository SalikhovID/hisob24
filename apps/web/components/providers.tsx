"use client"

import { QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "next-themes"
import { type ReactNode, useState } from "react"
import { Toaster } from "@/components/ui/sonner"
import { makeQueryClient } from "@/lib/query-client"

// Providers wraps every page: the light/dark theme, the query client (a
// lost session leads to /login) and the toasts.
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => makeQueryClient())
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster position="top-center" richColors />
      </QueryClientProvider>
    </ThemeProvider>
  )
}
