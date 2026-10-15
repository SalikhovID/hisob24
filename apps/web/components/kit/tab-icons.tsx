import { type ComponentProps, type FC, useId } from "react"
import { MARK_24 } from "@/components/logo"
import type { NavKey, PageKey } from "@/lib/nav"

// The tab bar's icons are the prototype's filled marks, 28×28, in the
// current color; the ones with a cut-out (the home's "24", the mark's own
// shape, the tasks' tick,
// the box, the bag, the warehouse, the wallet) mask it with an id of their
// own, so two of a kind on one page do not share one.
type Props = ComponentProps<"svg">

const frame = (props: Props): Props => ({ viewBox: "0 0 28 28", fill: "currentColor", "aria-hidden": true, ...props })

const Home: FC<Props> = (props) => {
  const id = useId()
  return (
    <svg {...frame(props)}>
      <mask id={id}>
        <rect width="28" height="28" fill="#fff" />
        {/* The mark's own "24", cut out of the tile (a shape, not text: the
            tab's name is its label's). */}
        <path d={MARK_24} fill="#000" fillRule="evenodd" clipRule="evenodd" transform="translate(6.6 9.4) scale(0.0574) translate(-218.22 -173)" />
      </mask>
      <rect x="3" y="3" width="22" height="22" rx="7" mask={`url(#${id})`} />
    </svg>
  )
}

const Customers: FC<Props> = (props) => (
  <svg {...frame(props)}>
    <circle cx="14" cy="9" r="5.2" />
    <path d="M3.8 24.5c0-5.4 4.5-9.2 10.2-9.2s10.2 3.8 10.2 9.2z" />
  </svg>
)

const Tasks: FC<Props> = (props) => {
  const id = useId()
  return (
    <svg {...frame(props)}>
      <mask id={id}>
        <rect width="28" height="28" fill="#fff" />
        <path d="M8.6 10.2l2.4 2.4 4.4-4.6M9 19h10" stroke="#000" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </mask>
      <rect x="3.5" y="3" width="21" height="22.5" rx="6" mask={`url(#${id})`} />
    </svg>
  )
}

const Products: FC<Props> = (props) => {
  const id = useId()
  return (
    <svg {...frame(props)}>
      <mask id={id}>
        <rect width="28" height="28" fill="#fff" />
        <path d="M4 8l10 5 10-5M14 13v12" stroke="#000" strokeWidth="2" strokeLinejoin="round" fill="none" />
      </mask>
      <path d="M14 2.5l10.5 5.2v12.6L14 25.5 3.5 20.3V7.7z" mask={`url(#${id})`} />
    </svg>
  )
}

const Sales: FC<Props> = (props) => {
  const id = useId()
  return (
    <svg {...frame(props)}>
      <mask id={id}>
        <rect width="28" height="28" fill="#fff" />
        <path d="M10 11V8a4 4 0 0 1 8 0v3" stroke="#000" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      </mask>
      <path d="M5.5 9.5h17l-1.3 14.2a1.5 1.5 0 0 1-1.5 1.3H8.3a1.5 1.5 0 0 1-1.5-1.3z" mask={`url(#${id})`} />
      <path d="M10 9.5V8a4 4 0 0 1 8 0v1.5h-2.2V8a1.8 1.8 0 0 0-3.6 0v1.5z" />
    </svg>
  )
}

const Warehouse: FC<Props> = (props) => {
  const id = useId()
  return (
    <svg {...frame(props)}>
      <mask id={id}>
        <rect width="28" height="28" fill="#fff" />
        <path d="M9 15h10M9 18.5h10M9 22h10" stroke="#000" strokeWidth="2" strokeLinecap="round" />
      </mask>
      <path d="M2.5 10.5L14 3.5l11.5 7v13.5a1.5 1.5 0 0 1-1.5 1.5H4a1.5 1.5 0 0 1-1.5-1.5z" mask={`url(#${id})`} />
    </svg>
  )
}

const Finance: FC<Props> = (props) => {
  const id = useId()
  return (
    <svg {...frame(props)}>
      <mask id={id}>
        <rect width="28" height="28" fill="#fff" />
        <rect x="17" y="13" width="6.5" height="5" rx="2" fill="#000" />
      </mask>
      <path d="M3.5 9.5A3.5 3.5 0 0 1 7 6h12.5a3 3 0 0 1 3 3v1H7.5a1 1 0 0 0 0 2h17v10a3 3 0 0 1-3 3H7a3.5 3.5 0 0 1-3.5-3.5z" mask={`url(#${id})`} />
    </svg>
  )
}

const Employees: FC<Props> = (props) => (
  <svg {...frame(props)}>
    <circle cx="10.5" cy="9.5" r="4.6" />
    <path d="M1.8 23.5c0-4.8 3.8-8.2 8.7-8.2s8.7 3.4 8.7 8.2z" />
    <circle cx="19.5" cy="8.6" r="3.6" />
    <path d="M20.4 14.3c3.6.3 6.1 3.2 6.1 7.2h-5.7c-.2-2.9-1.4-5.3-3.4-6.8.9-.3 1.9-.4 3-.4z" />
  </svg>
)

const Settings: FC<Props> = (props) => (
  <svg {...frame(props)}>
    <path
      fillRule="evenodd"
      d="M24.84,12.14 L24.84,15.86 L22.39,15.90 L21.27,18.59 L22.98,20.35 L20.35,22.98 L18.59,21.27 L15.90,22.39 L15.86,24.84 L12.14,24.84 L12.10,22.39 L9.41,21.27 L7.65,22.98 L5.02,20.35 L6.73,18.59 L5.61,15.90 L3.16,15.86 L3.16,12.14 L5.61,12.10 L6.73,9.41 L5.02,7.65 L7.65,5.02 L9.41,6.73 L12.10,5.61 L12.14,3.16 L15.86,3.16 L15.90,5.61 L18.59,6.73 L20.35,5.02 L22.98,7.65 L21.27,9.41 L22.39,12.10Z M17.6,14 a3.6,3.6 0 1,0 -7.2,0 a3.6,3.6 0 1,0 7.2,0Z"
    />
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

// The pages of the sections with several (logic/roles.md, section 8) wear
// marks of the same kind, after the lucide icons their rows wear: the
// services a wrench, the purchases a receipt, the transfers two arrows,
// the inventories a clipboard ticked, the opening stock a crate with a
// plus, the suppliers a truck, the expenses and the money transfers a coin
// with what the money does.

const Services: FC<Props> = (props) => {
  const id = useId()
  return (
    <svg {...frame(props)}>
      <mask id={id}>
        <rect width="28" height="28" fill="#fff" />
        <rect x="11.6" y="0" width="4.8" height="7.8" rx="1" fill="#000" transform="rotate(45 14 14)" />
        <circle cx="14" cy="23.6" r="1.3" fill="#000" transform="rotate(45 14 14)" />
      </mask>
      <g mask={`url(#${id})`}>
        <g transform="rotate(45 14 14)">
          <circle cx="14" cy="7.6" r="6.4" />
          <rect x="11.4" y="11" width="5.2" height="15.6" rx="2.6" />
        </g>
      </g>
    </svg>
  )
}

const Purchases: FC<Props> = (props) => {
  const id = useId()
  return (
    <svg {...frame(props)}>
      <mask id={id}>
        <rect width="28" height="28" fill="#fff" />
        <path d="M9 9.5h10M9 14h10M9 18.5h6" stroke="#000" strokeWidth="2.2" strokeLinecap="round" />
      </mask>
      <path
        d="M4.5 5A1.5 1.5 0 0 1 6 3.5h16A1.5 1.5 0 0 1 23.5 5v20.5l-3.17-2.1-3.16 2.1-3.17-2.1-3.17 2.1-3.16-2.1-3.17 2.1z"
        mask={`url(#${id})`}
      />
    </svg>
  )
}

const Transfers: FC<Props> = (props) => (
  <svg {...frame(props)}>
    <path d="M5.5 6.5H18v-3l7 5-7 5v-3H5.5a2 2 0 0 1 0-4z" />
    <path d="M22.5 17.5H10v-3l-7 5 7 5v-3h12.5a2 2 0 0 0 0-4z" />
  </svg>
)

const Inventories: FC<Props> = (props) => {
  const id = useId()
  return (
    <svg {...frame(props)}>
      <mask id={id}>
        <rect width="28" height="28" fill="#fff" />
        {/* A gap round the clip, the clip itself, the tick. */}
        <rect x="8.2" y="0.7" width="11.6" height="7.6" rx="2.8" fill="#000" />
        <rect x="9.5" y="2" width="9" height="5" rx="2" fill="#fff" />
        <path d="M9.4 16l3.1 3.1 6.2-6.6" stroke="#000" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </mask>
      <g mask={`url(#${id})`}>
        <rect x="4.5" y="4.5" width="19" height="21" rx="4.5" />
        <rect x="9.5" y="2" width="9" height="5" rx="2" />
      </g>
    </svg>
  )
}

const OpeningStock: FC<Props> = (props) => {
  const id = useId()
  return (
    <svg {...frame(props)}>
      <mask id={id}>
        <rect width="28" height="28" fill="#fff" />
        <path d="M2 10.2h24" stroke="#000" strokeWidth="1.5" />
        <path d="M14 13.6v7.2M10.4 17.2h7.2" stroke="#000" strokeWidth="2.4" strokeLinecap="round" />
      </mask>
      <g mask={`url(#${id})`}>
        <rect x="2.5" y="4.5" width="23" height="6" rx="2" />
        <rect x="4" y="9.5" width="20" height="15" rx="3" />
      </g>
    </svg>
  )
}

const Suppliers: FC<Props> = (props) => {
  const id = useId()
  return (
    <svg {...frame(props)}>
      <mask id={id}>
        <rect width="28" height="28" fill="#fff" />
        {/* A gap round each wheel, the wheel, its hub, the cab's window. */}
        <circle cx="7.5" cy="21" r="4.2" fill="#000" />
        <circle cx="20.5" cy="21" r="4.2" fill="#000" />
        <circle cx="7.5" cy="21" r="2.9" fill="#fff" />
        <circle cx="20.5" cy="21" r="2.9" fill="#fff" />
        <circle cx="7.5" cy="21" r="1.1" fill="#000" />
        <circle cx="20.5" cy="21" r="1.1" fill="#000" />
        <path d="M19.3 11.8h1.9l2.2 3.2h-4.1z" fill="#000" />
      </mask>
      <g mask={`url(#${id})`}>
        <rect x="1.5" y="5.5" width="15.5" height="14.5" rx="2" />
        <path d="M17 9.8h4.8a2 2 0 0 1 1.65.87l2.85 4.15a2 2 0 0 1 .35 1.13V19a1 1 0 0 1-1 1H17z" />
        <circle cx="7.5" cy="21" r="2.9" />
        <circle cx="20.5" cy="21" r="2.9" />
      </g>
    </svg>
  )
}

const Expenses: FC<Props> = (props) => {
  const id = useId()
  return (
    <svg {...frame(props)}>
      <mask id={id}>
        <rect width="28" height="28" fill="#fff" />
        <path d="M10 18l8-8M12 10h6v6" stroke="#000" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </mask>
      <circle cx="14" cy="14" r="11" mask={`url(#${id})`} />
    </svg>
  )
}

const MoneyTransfers: FC<Props> = (props) => {
  const id = useId()
  return (
    <svg {...frame(props)}>
      <mask id={id}>
        <rect width="28" height="28" fill="#fff" />
        <path
          d="M8.5 11h11M16.5 8l3 3-3 3M19.5 17h-11M11.5 14l-3 3 3 3"
          stroke="#000"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </mask>
      <circle cx="14" cy="14" r="11" mask={`url(#${id})`} />
    </svg>
  )
}

// pageIcons are the tab bar's icons of the menu's pages: a section's own
// page wears the section's, the cash the finance's wallet.
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
