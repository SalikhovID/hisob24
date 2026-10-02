import type { NextConfig } from "next"

// The browser and the Telegram WebView reach the Go API through this origin:
// /api/* is proxied to API_URL, so cookies stay first-party.
const apiUrl = process.env.API_URL ?? "http://localhost:8080"

const nextConfig: NextConfig = {
  // e2e runs its own dev server next to start.sh's, so it builds elsewhere.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiUrl}/:path*` }]
  },
}

export default nextConfig
