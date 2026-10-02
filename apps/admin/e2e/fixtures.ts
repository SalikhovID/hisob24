import { defineNetworkFixture, type NetworkFixture } from "@msw/playwright"
import { test as base, expect } from "@playwright/test"
import type { AnyHandler } from "msw"
import { resetDb } from "../mocks/data"
import { handlers } from "../mocks/handlers"

interface Fixtures {
  handlers: AnyHandler[]
  network: NetworkFixture
  // telegramScript stands in for telegram.org's telegram-web-app.js: empty
  // outside Telegram, a fake WebApp in the Mini App tests.
  telegramScript: string
}

export const test = base.extend<Fixtures>({
  handlers: [handlers, { option: true }],
  telegramScript: ["", { option: true }],
  network: [
    async ({ context, handlers }, provide) => {
      resetDb()
      const network = defineNetworkFixture({ context, handlers })
      await network.enable()
      await provide(network)
      await network.disable()
    },
    { auto: true },
  ],
  page: async ({ page, telegramScript }, provide) => {
    await page.route("https://telegram.org/js/telegram-web-app.js*", (route) =>
      route.fulfill({ contentType: "text/javascript", body: telegramScript }),
    )
    await provide(page)
  },
})

export { expect }
