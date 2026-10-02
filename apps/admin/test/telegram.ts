import { vi } from "vitest"
import type { TelegramWebApp } from "@/types/telegram"

// fakeWebApp stands in for Telegram's WebApp; fire triggers an event the
// panel subscribed to with onEvent.
export function fakeWebApp(overrides: Partial<TelegramWebApp> = {}) {
  const handlers: Record<string, () => void> = {}
  const webApp = {
    initData: "query_id=AA&user=%7B%22id%22%3A461603558%7D&auth_date=1790000000&hash=abc",
    initDataUnsafe: { user: { id: 461603558, first_name: "Owner" } },
    colorScheme: "light" as const,
    themeParams: {},
    platform: "android",
    ready: vi.fn(),
    expand: vi.fn(),
    close: vi.fn(),
    onEvent: vi.fn((event: string, handler: () => void) => {
      handlers[event] = handler
    }),
    offEvent: vi.fn(),
    ...overrides,
    fire: (event: string) => handlers[event]?.(),
  }
  return webApp
}
