import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ThemeProvider } from "next-themes"
import type { ReactElement } from "react"
import { Toaster } from "@/components/ui/sonner"

// renderWithProviders renders ui inside the providers the app gives every
// page: theme, a query client without retries, and the toaster. rerender
// renders another ui inside the same providers (the same query client).
export function renderWithProviders(ui: ReactElement, options: Parameters<typeof userEvent.setup>[0] = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false }, mutations: { retry: false } },
  })
  const user = userEvent.setup(options)
  const wrap = (inner: ReactElement) => (
    <ThemeProvider attribute="class" defaultTheme="light">
      <QueryClientProvider client={queryClient}>
        {inner}
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  )
  const result = render(wrap(ui))
  return { user, queryClient, ...result, rerender: (next: ReactElement) => result.rerender(wrap(next)) }
}
