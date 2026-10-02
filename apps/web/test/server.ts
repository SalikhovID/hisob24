import { setupServer } from "msw/node"
import { handlers } from "@/mocks/handlers"

// The MSW server every Vitest test talks to; tests override it with use().
export const server = setupServer(...handlers)
