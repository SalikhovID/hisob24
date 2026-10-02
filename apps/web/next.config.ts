import type { NextConfig } from "next"

// The browser reaches the Go API through this origin: /api/* is proxied to
// API_URL, so the refresh_token cookie stays first-party.
const apiUrl = process.env.API_URL ?? "http://localhost:8080"

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiUrl}/:path*` }]
  },
}

export default nextConfig
