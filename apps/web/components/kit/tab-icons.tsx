import { ClipboardCheckIcon, PackagePlusIcon, WrenchIcon } from "lucide-react"
import type { ComponentProps, FC } from "react"
import type { NavKey, PageKey } from "@/lib/nav"

// The menu's icons are the prototype's outline marks (its o-* and i-*
// symbols): 24×24, a 1.8 stroke in the current color with round ends and
// joins, no fill. The tab bar, the sidebar, the settings' list of pages and
// the bar's editor wear them; a current tab draws its mark a little bolder
// (its own class). The pages the prototype has no mark for are drawn the
// same way: the services, the inventories and the opening stock are the
// lucide icons their rows wear, the expenses and the money transfers a coin
// with what the money does.
type Props = ComponentProps<"svg">

const frame = (props: Props): Props => ({
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  ...props,
})

const Home: FC<Props> = (props) => (
  <svg {...frame(props)}>
    <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H5.5A1.5 1.5 0 0 1 4 19z" />
  </svg>
)

const Customers: FC<Props> = (props) => (
  <svg {...frame(props)}>
    <circle cx="9" cy="8.5" r="3.5" />
    <path d="M2.5 19.5c1.2-3.3 3.6-5 6.5-5s5.3 1.7 6.5 5" />
    <path d="M15.5 5.2a3.4 3.4 0 0 1 0 6.6M18 14.6c1.7.6 2.9 2.2 3.5 4.9" />
  </svg>
)

const Tasks: FC<Props> = (props) => (
  <svg {...frame(props)}>
    <rect x="4.5" y="3.5" width="15" height="17" rx="3.5" />
    <path d="M8.5 9.2l2 2 4-4.2M8.5 15.5h7" />
  </svg>
)

const Products: FC<Props> = (props) => (
  <svg {...frame(props)}>
    <path d="M3.5 7.5L12 3.5l8.5 4v9L12 20.5l-8.5-4z" />
    <path d="M3.5 7.5l8.5 4 8.5-4M12 11.5v9" />
  </svg>
)

const Sales: FC<Props> = (props) => (
  <svg {...frame(props)}>
    <path d="M5.5 8h13l-1 12.5h-11z" />
    <path d="M9 10.5V7a3 3 0 0 1 6 0v3.5" />
  </svg>
)

const Warehouse: FC<Props> = (props) => (
  <svg {...frame(props)}>
    <path d="M3.5 9.5 12 4l8.5 5.5V20h-17z" />
    <path d="M8 20v-6.5h8V20M8 16.8h8" />
  </svg>
)

const Finance: FC<Props> = (props) => (
  <svg {...frame(props)}>
    <rect x="3" y="6" width="18" height="13.5" rx="3.5" />
    <path d="M3 10.5h18M15.5 15h2" />
  </svg>
)

const Employees: FC<Props> = (props) => (
  <svg {...frame(props)}>
    <rect x="4.5" y="3.5" width="15" height="17" rx="3.5" />
    <circle cx="12" cy="10" r="2.6" />
    <path d="M8 17c.8-1.8 2.2-2.7 4-2.7s3.2.9 4 2.7" />
  </svg>
)

const Settings: FC<Props> = (props) => (
  <svg {...frame(props)}>
    <circle cx="7" cy="7" r="2.4" />
    <circle cx="17" cy="17" r="2.4" />
    <path d="M9.4 7H20M4 17h10.6" />
  </svg>
)

export const tabIcons: Record<NavKey, FC<Props>> = {
  home: Home,
  customers: Customers,
  tasks: Tasks,
  products: Products,
  sales: Sales,
  warehouse: Warehouse,
  finance: Finance,
  employees: Employees,
  settings: Settings,
}

const Services: FC<Props> = (props) => <WrenchIcon {...frame(props)} />

const Purchases: FC<Props> = (props) => (
  <svg {...frame(props)}>
    <path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2z" />
    <path d="M9 8.5h6M9 12.5h6" />
  </svg>
)

const Transfers: FC<Props> = (props) => (
  <svg {...frame(props)}>
    <path d="M7 3.5L3.5 7 7 10.5M3.5 7h13M17 13.5l3.5 3.5-3.5 3.5M20.5 17h-13" />
  </svg>
)

const Inventories: FC<Props> = (props) => <ClipboardCheckIcon {...frame(props)} />

const OpeningStock: FC<Props> = (props) => <PackagePlusIcon {...frame(props)} />

const Suppliers: FC<Props> = (props) => (
  <svg {...frame(props)}>
    <path d="M3 6.5h11v9.5H3zM14 9.5h4l3 3.5v3h-7" />
    <circle cx="7" cy="17.5" r="1.8" />
    <circle cx="17.5" cy="17.5" r="1.8" />
  </svg>
)

const Expenses: FC<Props> = (props) => (
  <svg {...frame(props)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9.2 14.8l5.6-5.6M10.4 9.2h4.4v4.4" />
  </svg>
)

const MoneyTransfers: FC<Props> = (props) => (
  <svg {...frame(props)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M8.5 10.2h7M13.6 8.3l1.9 1.9-1.9 1.9M15.5 13.8h-7M10.4 11.9l-1.9 1.9 1.9 1.9" />
  </svg>
)

// pageIcons are the icons of the menu's pages: a section's own page wears
// the section's, the cash the finance's wallet.
export const pageIcons: Record<PageKey, FC<Props>> = {
  home: Home,
  customers: Customers,
  tasks: Tasks,
  products: Products,
  services: Services,
  sales: Sales,
  warehouse: Warehouse,
  purchases: Purchases,
  transfers: Transfers,
  inventories: Inventories,
  opening_stock: OpeningStock,
  suppliers: Suppliers,
  accounts: Finance,
  expenses: Expenses,
  money_transfers: MoneyTransfers,
  employees: Employees,
}
