import { defineNetworkFixture, type NetworkFixture } from "@msw/playwright"
import { test as base, expect } from "@playwright/test"
import type { AnyHandler } from "msw"
import { resetDb } from "../mocks/data"
import { handlers } from "../mocks/handlers"

interface Fixtures {
  handlers: AnyHandler[]
  network: NetworkFixture
}

export const test = base.extend<Fixtures>({
  handlers: [handlers, { option: true }],
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
})

export { expect }
