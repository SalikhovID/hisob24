import { QueryClientProvider } from "@tanstack/react-query"
import { render } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ThemeProvider } from "next-themes"
import type { ReactElement } from "react"
import { vi } from "vitest"
import { Toaster } from "@/components/ui/sonner"
import { makeQueryClient } from "@/lib/query-client"

// renderWithProviders renders ui inside the providers the app gives every
// page: theme, the app's query client (without retries; onUnauthorized
// records where a 401 would lead) and the toaster.
export function renderWithProviders(ui: ReactElement) {
  const onUnauthorized = vi.fn()
  const queryClient = makeQueryClient(onUnauthorized)
  queryClient.setDefaultOptions({ queries: { retry: false, refetchOnWindowFocus: false }, mutations: { retry: false } })
  const user = userEvent.setup()
  const result = render(
    <ThemeProvider attribute="class" defaultTheme="light">
      <QueryClientProvider client={queryClient}>
        {ui}
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>,
  )
  return { user, queryClient, onUnauthorized, ...result }
}
