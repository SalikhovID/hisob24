import type { ReactNode } from "react"
import { Logo24 } from "@/components/logo"

// LoginFrame is the login's page: the brand's panel and, in the page's main
// part, what is asked for. brand heads the page (the h1 holds it), tagline
// says what the product is. The panel's backdrop is the mark's number.
export function LoginFrame({ brand, tagline, children }: { brand: ReactNode; tagline: string; children: ReactNode }) {
  return (
    <div>
      <header>
        <Logo24 />
        <h1>{brand}</h1>
        <p>{tagline}</p>
      </header>
      <main>{children}</main>
    </div>
  )
}
