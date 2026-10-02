import { vi } from "vitest"
import type { TelegramWebApp } from "@/types/telegram"

// fakeWebApp stands in for Telegram's WebApp; fire triggers an event the
// app subscribed to with onEvent. Its initData is the Mini App of Telegram
// user telegramId (mocks/handlers.ts reads the id back).
export function fakeWebApp(overrides: Partial<TelegramWebApp> = {}, telegramId = 1001) {
  const handlers: Record<string, () => void> = {}
  const webApp = {
    initData: `query_id=AA&user=%7B%22id%22%3A${telegramId}%7D&auth_date=1790000000&hash=abc`,
    initDataUnsafe: { user: { id: telegramId, first_name: "Test" } },
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
