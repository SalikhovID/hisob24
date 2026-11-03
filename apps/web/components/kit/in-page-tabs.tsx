"use client"

import { Tabs } from "@base-ui/react/tabs"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import type { ReactNode } from "react"

export interface InPageTab {
  value: string
  label: string
  content: ReactNode
}

// InPageTabs are the prototype's tabs inside a record's page (Ma'lumot,
// Buyurtmalar, Hisob harakati, Tarix): the segmented control (a faint
// track, a white thumb under the chosen tab) over the chosen one's panel,
// the first at first. The tab chosen stays in the address (?tab=), so the
// way back to the page finds it; the first leaves the address bare. On a
// phone the tabs share the width; on the web they keep their words' width.
export function InPageTabs({ label, tabs }: { label: string; tabs: InPageTab[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const asked = params.get("tab")
  const value = tabs.some((tab) => tab.value === asked) ? (asked as string) : tabs[0]?.value
  const choose = (next: string) => {
    const query = new URLSearchParams(params.toString())
    if (next === tabs[0]?.value) query.delete("tab")
    else query.set("tab", next)
    const search = query.toString()
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false })
  }
  return (
    <Tabs.Root value={value} onValueChange={(next) => choose(String(next))}>
      <Tabs.List
        aria-label={label}
        data-slot="in-page-tabs"
        className="relative mb-4 flex gap-0.5 overflow-x-auto rounded-[9px] bg-muted p-0.5 scrollbar-hide md:w-max md:max-w-full md:rounded-lg"
      >
        <Tabs.Indicator
          aria-hidden="true"
          className="absolute top-0.5 left-0 h-8 w-(--active-tab-width) translate-x-(--active-tab-left) rounded-[7px] bg-(--seg-thumb) shadow-(--seg-shadow) transition-transform duration-300 ease-out-expo md:h-7 md:rounded-md"
        />
        {tabs.map((tab) => (
          <Tabs.Tab
            key={tab.value}
            value={tab.value}
            className="relative z-[1] flex min-h-8 flex-1 items-center justify-center rounded-[7px] px-3 text-[13px] font-medium whitespace-nowrap text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-active:text-foreground md:min-h-7 md:flex-none md:rounded-md md:text-[12.5px]"
          >
            {tab.label}
          </Tabs.Tab>
        ))}
      </Tabs.List>
      {tabs.map((tab) => (
        <Tabs.Panel key={tab.value} value={tab.value} className="outline-none">
          {tab.content}
        </Tabs.Panel>
      ))}
    </Tabs.Root>
  )
}
