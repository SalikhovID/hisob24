"use client"

import { ChevronRightIcon, XIcon } from "lucide-react"
import { useId } from "react"

// BannerArt is the prototype's picture at the banner's right: a tilted
// tile in the accent (black in the light, white in the dark) with "24" in
// the other end on it and a few grey sparkles. Its colors are the theme's
// (--art*): an SVG attribute cannot take a variable, a class can.
function BannerArt() {
  const id = useId()
  return (
    <svg data-slot="banner-art" viewBox="0 0 140 112" aria-hidden="true" className="pointer-events-none absolute right-1.5 -bottom-1.5 h-[112px] w-[140px]">
      <defs>
        <linearGradient id={`${id}-a`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" className="[stop-color:var(--art1)]" />
          <stop offset="1" className="[stop-color:var(--art2)]" />
        </linearGradient>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".6" />
          <stop offset=".55" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g transform="rotate(-12 80 64)">
        <rect x="40" y="26" width="80" height="80" rx="23" fill="#000" opacity=".18" transform="translate(5 9)" />
        <rect x="40" y="26" width="80" height="80" rx="23" fill={`url(#${id}-a)`} />
        <rect x="40" y="26" width="80" height="80" rx="23" fill={`url(#${id}-g)`} />
        <rect x="40.5" y="26.5" width="79" height="79" rx="22.5" fill="none" stroke="#fff" strokeOpacity=".5" />
        <text x="79" y="80" textAnchor="middle" fontFamily="-apple-system, Geist, system-ui, sans-serif" fontSize="38" fontWeight="800" fontStyle="italic" letterSpacing="-2" className="fill-(--art-ink)">
          24
        </text>
      </g>
      <path d="M24 30l2.2 5.3 5.3 2.2-5.3 2.2L24 45l-2.2-5.3-5.3-2.2 5.3-2.2z" className="fill-(--art-spark)" />
      <path d="M128 14l1.4 3.4 3.4 1.4-3.4 1.4-1.4 3.4-1.4-3.4-3.4-1.4 3.4-1.4z" className="fill-(--art-spark)" opacity=".9" />
      <path d="M30 84l1.1 2.6 2.6 1.1-2.6 1.1-1.1 2.6-1.1-2.6-2.6-1.1 2.6-1.1z" className="fill-(--art-spark)" opacity=".7" />
      <circle cx="132" cy="58" r="2" className="fill-(--art-spark)" opacity=".6" />
    </svg>
  )
}

// HomeBanner offers to add the Mini App to the phone's home screen
// (Telegram's addToHomeScreen): the prototype's card of its own gradient
// (white in the light, a dark grey in the dark) with the offer, a close
// button and the art.
export function HomeBanner({ onAdd, onDismiss }: { onAdd: () => void; onDismiss: () => void }) {
  return (
    <div
      data-slot="home-banner"
      className="relative mb-3 min-h-[100px] overflow-hidden rounded-group bg-(image:--ban) text-(--ban-ink) shadow-[var(--rim),var(--lift)]"
    >
      <button
        type="button"
        onClick={onAdd}
        className="block min-h-[100px] w-full py-4 pr-[140px] pl-[18px] text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
      >
        <span className="block text-[18px] leading-tight font-bold tracking-[-0.01em]">Hisob24&apos;ni bosh ekranga qo&apos;shing</span>
        <span className="mt-1.5 inline-flex items-center gap-0.5 text-sm font-semibold text-(--ban-sub)">
          Bir bosishda ochiladi
          <ChevronRightIcon aria-hidden="true" strokeWidth={2.6} className="size-[15px]" />
        </span>
      </button>
      <button
        type="button"
        aria-label="Yopish"
        onClick={onDismiss}
        className="absolute top-2 right-2 z-[2] grid size-9 place-items-center outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="grid size-6 place-items-center rounded-full bg-(--ban-x) shadow-[inset_0_0_0_.5px_rgba(255,255,255,.8)]">
          <XIcon strokeWidth={3} className="size-[13px]" />
        </span>
      </button>
      <BannerArt />
    </div>
  )
}
