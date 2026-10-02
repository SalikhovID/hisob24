import { redirect } from "next/navigation"

// The companies list is the panel's home page.
export default function Home() {
  redirect("/companies")
}
