"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"

// SettingsTab is one of the settings' tabs: what the company's customers
// are asked, what its tasks are asked, and the dropdowns both take their
// options from.
export type SettingsTab = "customers" | "tasks" | "dropdowns"

const tabs: SettingsTab[] = ["customers", "tasks", "dropdowns"]

// asTab reads a tab's name; anything else is the customers' tab.
export function asTab(value: unknown): SettingsTab {
  return tabs.find((candidate) => candidate === value) ?? "customers"
}

// settingsHref is the address of a tab of the settings: the customers are
// the page itself, the others name themselves.
export function settingsHref(tab: SettingsTab): string {
  return tab === "customers" ? "/settings" : `/settings?tab=${tab}`
}

// useSettingsTab keeps the settings' open tab in the address, so a reload,
// the back button or a page's way back finds the same tab. An address that
// names no tab, or one that is not there, opens the customers.
export function useSettingsTab(): [SettingsTab, (tab: SettingsTab) => void] {
  const params = useSearchParams()
  const router = useRouter()
  const tab = asTab(params.get("tab"))
  const select = useCallback((next: SettingsTab) => router.replace(settingsHref(next)), [router])
  return [tab, select]
}
