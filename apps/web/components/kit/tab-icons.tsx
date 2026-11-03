import {
  ArrowDownLeftIcon,
  ArrowLeftRightIcon,
  ClipboardCheckIcon,
  ContactIcon,
  HouseIcon,
  ListTodoIcon,
  type LucideIcon,
  PackageIcon,
  PackageOpenIcon,
  PackagePlusIcon,
  Repeat2Icon,
  SettingsIcon,
  ShoppingCartIcon,
  TruckIcon,
  UsersIcon,
  WalletIcon,
  WarehouseIcon,
  WrenchIcon,
} from "lucide-react"
import type { ComponentProps, FC } from "react"
import type { NavKey, PageKey } from "@/lib/nav"

// The menu's icons are the prototype's: lucide outline icons with a 1.75
// stroke in the current color (the sidebar, the tab bar, the settings' list
// of pages and the bar's editor wear them; a current tab draws its icon a
// little bolder through its own strokeWidth). They are decoration: the
// links' names say where they lead.
type Props = ComponentProps<"svg">

const icon =
  (Icon: LucideIcon): FC<Props> =>
  // eslint-disable-next-line react/display-name
  (props) => <Icon strokeWidth={1.75} aria-hidden="true" {...(props as object)} />

export const tabIcons: Record<NavKey, FC<Props>> = {
  home: icon(HouseIcon),
  customers: icon(ContactIcon),
  orders: icon(ListTodoIcon),
  products: icon(PackageIcon),
  sales: icon(ShoppingCartIcon),
  warehouse: icon(WarehouseIcon),
  finance: icon(WalletIcon),
  employees: icon(UsersIcon),
  settings: icon(SettingsIcon),
}

// pageIcons are the icons of the menu's pages: a section's own page wears
// the section's, the cash the finance's wallet; the warehouse's and the
// finance's other pages the prototype's icons of what they do.
export const pageIcons: Record<PageKey, FC<Props>> = {
  home: tabIcons.home,
  customers: tabIcons.customers,
  orders: tabIcons.orders,
  products: tabIcons.products,
  services: icon(WrenchIcon),
  sales: tabIcons.sales,
  warehouse: tabIcons.warehouse,
  purchases: icon(PackagePlusIcon),
  transfers: icon(ArrowLeftRightIcon),
  inventories: icon(ClipboardCheckIcon),
  opening_stock: icon(PackageOpenIcon),
  suppliers: icon(TruckIcon),
  accounts: tabIcons.finance,
  expenses: icon(ArrowDownLeftIcon),
  money_transfers: icon(Repeat2Icon),
  employees: tabIcons.employees,
}
