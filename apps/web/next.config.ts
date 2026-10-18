import type { NextConfig } from "next"

// The browser reaches the Go API through this origin: /api/* is proxied to
// API_URL, so the refresh_token cookie stays first-party.
const apiUrl = process.env.API_URL ?? "http://localhost:8080"

const nextConfig: NextConfig = {
  // e2e runs its own dev server next to start.sh's, so it builds elsewhere.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // e2e hides the dev indicator: in its corner it would cover the floating
  // tab bar's first tab. Errors are still shown.
  ...(process.env.HIDE_DEV_INDICATOR === "1" && { devIndicators: false as const }),
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiUrl}/:path*` }]
  },
  // The orders' pages were the tasks' until 2026-10-18: an address kept from
  // then (a bookmark, the history) leads to the page it meant, its query kept.
  async redirects() {
    return [
      { source: "/tasks/:path*", destination: "/orders/:path*", permanent: true },
      { source: "/settings/task-types/:path*", destination: "/settings/order-types/:path*", permanent: true },
    ]
  },
}

export default nextConfig
