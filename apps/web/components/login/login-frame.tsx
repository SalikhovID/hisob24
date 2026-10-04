import type { ReactNode } from "react"

// LoginFrame is the login's page: the brand's panel and what is asked for.
// brand heads the page (the h1 holds it), tagline says what the product is.
export function LoginFrame({ brand, tagline }: { brand: ReactNode; tagline: string; children: ReactNode }) {
  return (
    <div>
      <header>
        <h1>{brand}</h1>
        <p>{tagline}</p>
      </header>
    </div>
  )
}
