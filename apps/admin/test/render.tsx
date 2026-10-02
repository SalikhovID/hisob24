import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ThemeProvider } from "next-themes"
import type { ReactElement } from "react"
import { Toaster } from "@/components/ui/sonner"

// renderWithProviders renders ui inside the providers the app gives every
// page: theme, a fresh query client without retries, and the toaster.
export function renderWithProviders(ui: ReactElement, queryClient = testQueryClient()) {
  const user = userEvent.setup()
  const result = render(
    <ThemeProvider attribute="class" defaultTheme="light">
      <QueryClientProvider client={queryClient}>
        {ui}
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>,
  )
  return { user, queryClient, ...result }
}

export function testQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
}
