// SettingsTab is a part of the settings, each on a page of its own: what the
// company's customers are asked, what its orders are asked and the stages
// they go through, the dropdowns both take their options from, the
// currency rates, the finance categories, and the roles (the owner's alone).
export type SettingsTab = "customers" | "orders" | "stages" | "dropdowns" | "currencies" | "finance" | "roles"

const pages: Record<SettingsTab, string> = {
  customers: "/settings/customer-types",
  orders: "/settings/order-types",
  stages: "/settings/stages",
  dropdowns: "/settings/dropdowns",
  currencies: "/settings/currencies",
  finance: "/settings/finance-categories",
  roles: "/settings/roles",
}

// settingsHref is the address of a part of the settings.
export function settingsHref(tab: SettingsTab): string {
  return pages[tab]
}

// oldTabHref is where an address of the settings' old tabs (/settings?tab=x)
// leads now: the part's page; null with no tab named, or one not there. The
// orders' part was the tab of the tasks then.
export function oldTabHref(tab: string | null): string | null {
  const part = tab === "tasks" ? "orders" : tab
  return part !== null && part in pages ? pages[part as SettingsTab] : null
}
