import { type ComponentProps, type FC, useId } from "react"
import type { NavKey } from "@/lib/nav"

// The tab bar's icons are the prototype's filled marks, 28×28, in the
// current color; the ones with a cut-out (the home's "24", the tasks' tick,
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
        <text
          x="14"
          y="18.6"
          textAnchor="middle"
          fontFamily="-apple-system, Geist, system-ui, sans-serif"
          fontSize="11.5"
          fontWeight="800"
          fontStyle="italic"
          letterSpacing="-.6"
          fill="#000"
        >
          24
        </text>
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
