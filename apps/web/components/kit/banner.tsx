"use client"

import { ChevronRightIcon, XIcon } from "lucide-react"

// BannerArt is the picture at the banner's right: a tilted flat tile in the
// brand's teal with a white "24" on it and a few faint sparkles.
function BannerArt() {
  return (
    <svg data-slot="banner-art" viewBox="0 0 140 112" aria-hidden="true" className="pointer-events-none absolute right-1.5 -bottom-1.5 h-[104px] w-[130px]">
      <g transform="rotate(-12 80 64)">
        <rect x="40" y="26" width="80" height="80" rx="20" className="fill-brand-mark" />
        <text x="79" y="80" textAnchor="middle" fontFamily="-apple-system, Inter, system-ui, sans-serif" fontSize="38" fontWeight="800" fontStyle="italic" letterSpacing="-2" fill="#fff">
          24
        </text>
      </g>
      <path d="M24 30l2.2 5.3 5.3 2.2-5.3 2.2L24 45l-2.2-5.3-5.3-2.2 5.3-2.2z" className="fill-faint" />
      <path d="M128 14l1.4 3.4 3.4 1.4-3.4 1.4-1.4 3.4-1.4-3.4-3.4-1.4 3.4-1.4z" className="fill-faint" opacity=".9" />
      <circle cx="132" cy="58" r="2" className="fill-faint" opacity=".6" />
    </svg>
  )
}

// HomeBanner offers to add the Mini App to the phone's home screen
// (Telegram's addToHomeScreen): a flat card with the offer, the way in in
// the accent's words, a plain close icon and the art.
export function HomeBanner({ onAdd, onDismiss }: { onAdd: () => void; onDismiss: () => void }) {
  return (
    <div
      data-slot="home-banner"
      className="relative mb-4 min-h-[92px] overflow-hidden rounded-group surface text-foreground md:rounded-lg"
    >
      <button
        type="button"
        onClick={onAdd}
        className="block min-h-[92px] w-full py-4 pr-[130px] pl-4 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
      >
        <span className="block text-[17px] leading-tight font-semibold md:text-[14px]">Hisob24&apos;ni bosh ekranga qo&apos;shing</span>
        <span className="mt-1.5 inline-flex items-center gap-0.5 text-[15px] font-medium text-accent-text md:text-[12.5px]">
          Bir bosishda ochiladi
          <ChevronRightIcon aria-hidden="true" strokeWidth={2} className="size-4" />
        </span>
      </button>
      <button
        type="button"
        aria-label="Yopish"
        onClick={onDismiss}
        className="absolute top-2 right-2 z-[2] grid size-[30px] place-items-center rounded-md text-icon outline-none hover:bg-ink-1 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <XIcon strokeWidth={2} className="size-4" />
      </button>
      <BannerArt />
    </div>
  )
}
